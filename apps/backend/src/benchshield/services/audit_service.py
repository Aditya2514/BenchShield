"""Phase B3 audit services: verification, findings, append-only reviews and frozen reports.

Privacy boundary: gold answers are read only through TrustedVaultReader on the
restricted verifier connection. They are never written to findings, events,
reports or logs; snapshot previews returned to clients have the reference answer
redacted, with an excerpt locator pointing reviewers at the exact location.
"""

import hashlib
import json
import logging
import re
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from benchshield.api.auth import AuthenticatedActor
from benchshield.config import Settings, get_settings
from benchshield.domain.enums import (
    ClaimStatus,
    EventType,
    InvestigationStatus,
    ReportStatus,
    ReviewAction,
    SnapshotAvailability,
    SourceFamily,
    TemporalStatus,
)
from benchshield.domain.models.events import VerificationCompletedPayload
from benchshield.domain.models.evidence import ExcerptLocator, SourceSnapshot
from benchshield.domain.models.findings import (
    EvidenceClaim,
    FindingListResponse,
    FindingView,
    TemporalAssessment,
    VerificationResult,
)
from benchshield.domain.models.reports import (
    ReportStatusResponse,
    ReportSummaryCounts,
)
from benchshield.domain.models.reviews import (
    ReviewCreateRequest,
    ReviewDecision,
    ReviewHistoryResponse,
)
from benchshield.persistence.database import get_verifier_session_factory
from benchshield.persistence.models import (
    AuditEventModel,
    CandidateSourceModel,
    EvaluationPolicyVersionModel,
    FindingModel,
    InvestigationModel,
    InvestigationTaskModel,
    ItemVersionModel,
    OperationalEventModel,
    ReportModel,
    ReviewDecisionModel,
)
from benchshield.services.vault_service import TrustedVaultReader
from benchshield.verification.grader import (
    GRADER_VERSION,
    NORMALIZATION_VERSION,
    assess_temporal,
    grade,
)

logger = logging.getLogger(__name__)

METHODOLOGY_VERSION = "audit_v1.0"
EXTRACTION_VERSION = "extract_v1.0"
REDACTION_TOKEN = "[REDACTED_REFERENCE_ANSWER]"
WITHHELD_PREVIEW = (
    "[Preview withheld: it contains text equal to the protected reference answer "
    "outside a matched answer. Open the source URL to inspect it.]"
)
# Answer matches where the grader found the answer on the page. Masking it there
# only marks what the finding already reports as exposed.
_ANSWER_FOUND = {"exact", "normalized", "task_specific"}
PREVIEW_CHARS = 800
REPORT_DOWNLOAD_TTL = timedelta(minutes=15)

VERIFIABLE_STATES = {
    InvestigationStatus.AWAITING_REVIEW.value,
    InvestigationStatus.COMPLETED.value,
    InvestigationStatus.CANCELLED.value,
    InvestigationStatus.BUDGET_EXHAUSTED.value,
}

REVIEW_TO_CLAIM = {
    ReviewAction.CONFIRM: ClaimStatus.VERIFIED,
    ReviewAction.REJECT: ClaimStatus.REJECTED,
    ReviewAction.REQUEST_MORE_EVIDENCE: ClaimStatus.NEEDS_REVIEW,
}


def _not_found(kind: str, ident: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail=f"{kind} '{ident}' not found."
    )


def _source_family(url: str) -> SourceFamily:
    if "github.com" in url or "huggingface.co" in url or "gitlab.com" in url:
        return SourceFamily.CODE_REPOSITORY
    if "arxiv.org" in url or "openreview.net" in url:
        return SourceFamily.ACADEMIC_ARCHIVE
    if "reddit.com" in url or "stackexchange.com" in url or "stackoverflow.com" in url:
        return SourceFamily.DISCUSSION_FORUM
    return SourceFamily.WEB_SEARCH


def _redact(text: str, secret: str) -> str:
    secret = (secret or "").strip()
    if not secret:
        return text
    pattern = re.compile(rf"(?<!\w){re.escape(secret)}(?!\w)", re.IGNORECASE)
    return pattern.sub(REDACTION_TOKEN, text)


def safe_preview(text: str, secret: str, answer_match: str) -> str:
    """Preview that never reveals the gold answer to API readers.

    Masking in place leaks the answer when the grader did not find it as an
    answer: anyone can diff the masked preview against the public page (e.g.
    "page [REDACTED] of 10" gives away "6"). In that case the whole preview is
    withheld instead.
    """
    redacted = _redact(text, secret)
    if redacted != text and answer_match not in _ANSWER_FOUND:
        return WITHHELD_PREVIEW
    return redacted


def _locate(content: str, question: str) -> ExcerptLocator | None:
    idx = content.lower().find(question.strip().lower()[:80])
    if idx < 0:
        return None
    end = idx + len(question.strip())
    line_start = content.count("\n", 0, idx) + 1
    line_end = content.count("\n", 0, min(end, len(content))) + 1
    return ExcerptLocator(
        line_start=line_start,
        line_end=line_end,
        char_offset_start=idx,
        char_offset_end=min(end, len(content)),
    )


def finding_to_view(f: FindingModel) -> FindingView:
    return FindingView(
        finding_id=f.id,
        investigation_id=f.investigation_id,
        item_version_id=f.item_version_id,
        external_id=f.external_id,
        version=f.version,
        claim=EvidenceClaim.model_validate(f.claim | {"claim_status": f.claim_status}),
        verification=VerificationResult.model_validate(f.verification),
        temporal=TemporalAssessment.model_validate(f.temporal),
        snapshot=SourceSnapshot.model_validate(f.snapshot),
        current_reviewer_decision=f.current_reviewer_decision,
        created_at=f.created_at,
        updated_at=f.updated_at,
    )


class AuditService:
    def __init__(self, db: AsyncSession, settings: Settings | None = None):
        self.db = db
        self.settings = settings or get_settings()

    # ------------------------------------------------------------------ helpers
    async def _load_investigation(self, investigation_id: str, actor: AuthenticatedActor):
        stmt = select(InvestigationModel).where(
            InvestigationModel.id == investigation_id,
            InvestigationModel.workspace_id == actor.workspace_id,
        )
        inv = (await self.db.execute(stmt)).scalar_one_or_none()
        if inv is None:
            raise _not_found("Investigation", investigation_id)
        return inv

    async def _emit(self, inv: InvestigationModel, event_type: EventType, payload: dict) -> None:
        seq_stmt = select(
            func.coalesce(func.max(OperationalEventModel.sequence_number), 0) + 1
        ).where(OperationalEventModel.investigation_id == inv.id)
        next_seq = (await self.db.execute(seq_stmt)).scalar() or 1
        self.db.add(
            OperationalEventModel(
                id=f"evt_{uuid4().hex[:16]}",
                workspace_id=inv.workspace_id,
                investigation_id=inv.id,
                sequence_number=next_seq,
                event_type=event_type.value,
                payload=payload,
            )
        )
        await self.db.flush()

    def _audit(self, actor, action, target_type, target_id, correlation_id, details=None):
        self.db.add(
            AuditEventModel(
                id=f"aud_{uuid4().hex[:16]}",
                workspace_id=actor.workspace_id,
                actor_id=actor.user_id,
                action=action,
                target_type=target_type,
                target_id=target_id,
                correlation_id=correlation_id[:64],
                outcome="success",
                details=details or {},
            )
        )

    # ------------------------------------------------------------- verification
    async def verify_investigation(
        self, investigation_id: str, actor: AuthenticatedActor, correlation_id: str
    ) -> dict:
        """Grade every unverified candidate source into a finding. Idempotent."""
        inv = await self._load_investigation(investigation_id, actor)
        if inv.status not in VERIFIABLE_STATES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Investigation is '{inv.status}'; verification runs after discovery ends.",
            )
        policy = await self.db.get(EvaluationPolicyVersionModel, inv.policy_version_id)

        stmt = (
            select(CandidateSourceModel, ItemVersionModel)
            .join(InvestigationTaskModel, InvestigationTaskModel.id == CandidateSourceModel.task_id)
            .join(ItemVersionModel, ItemVersionModel.id == InvestigationTaskModel.item_version_id)
            .outerjoin(
                FindingModel,
                (FindingModel.candidate_source_id == CandidateSourceModel.id)
                & (FindingModel.workspace_id == CandidateSourceModel.workspace_id),
            )
            .where(
                CandidateSourceModel.investigation_id == inv.id,
                CandidateSourceModel.workspace_id == actor.workspace_id,
                FindingModel.id.is_(None),
            )
            .order_by(CandidateSourceModel.retrieved_at)
        )
        pending = (await self.db.execute(stmt)).all()

        created = 0
        verifier_factory = get_verifier_session_factory(self.settings)
        async with verifier_factory() as vsession:
            vault = TrustedVaultReader(vsession, settings=self.settings)
            for cand, item in pending:
                gold_text, _gold_choice = await vault.get_protected_answer(
                    item.answer_revision_id, actor.workspace_id
                )
                content = cand.snapshot_content or ""
                available = bool(content)
                result = grade(item.task_type, item.question, gold_text, content)
                temporal_status, times = assess_temporal(
                    policy.evaluation_cutoff, cand.retrieved_at, cand.evidence_metadata
                )
                claim_status = result.claim_status
                limitations: list[str] = []
                if not available:
                    claim_status = ClaimStatus.NEEDS_REVIEW
                    limitations.append(
                        "Snapshot content unavailable; claim cannot be auto-verified."
                    )
                if temporal_status == TemporalStatus.OBSERVED_POST_CUTOFF:
                    limitations.append(
                        "Observed after the evaluation cutoff; introduction time unknown."
                    )

                fid = f"fnd_{uuid4().hex[:16]}"
                locator = _locate(content, item.question)
                start = max(0, (locator.char_offset_start or 0) - 200) if locator else 0
                preview = safe_preview(
                    content[start : start + PREVIEW_CHARS], gold_text, result.answer_match.value
                )
                snapshot = SourceSnapshot(
                    snapshot_id=cand.id,
                    source_url=cand.url,
                    final_url=cand.url,
                    retrieved_at=cand.retrieved_at,
                    source_family=_source_family(cand.url),
                    content_hash=cand.content_sha256
                    or hashlib.sha256(content.encode()).hexdigest(),
                    raw_content_preview=preview or None,
                    extraction_version=EXTRACTION_VERSION,
                    excerpt_locator=locator,
                    media_type=(cand.evidence_metadata or {}).get("media_type", "text/html"),
                    availability=(
                        SnapshotAvailability.AVAILABLE
                        if available
                        else SnapshotAvailability.INACCESSIBLE
                    ),
                    access_limitations=limitations,
                )
                model = FindingModel(
                    id=fid,
                    workspace_id=actor.workspace_id,
                    investigation_id=inv.id,
                    candidate_source_id=cand.id,
                    item_version_id=item.id,
                    external_id=item.external_id,
                    version=1,
                    exposure_type=result.exposure_type.value,
                    claim_status=claim_status.value,
                    auto_claim_status=claim_status.value,
                    task_identity=result.task_identity.value,
                    answer_match=result.answer_match.value,
                    temporal_status=temporal_status.value,
                    claim={
                        "claim_id": f"clm_{fid[4:]}",
                        "exposure_type": result.exposure_type.value,
                        "rationale": result.claim_rationale,
                    },
                    verification={
                        "verification_id": f"ver_{fid[4:]}",
                        "task_identity": result.task_identity.value,
                        "answer_match": result.answer_match.value,
                        "normalization_version": NORMALIZATION_VERSION,
                        "grader_version": GRADER_VERSION,
                        "explanation": f"{result.identity_explanation} {result.answer_explanation}",
                    },
                    temporal={
                        "assessment_id": f"tmp_{fid[4:]}",
                        "temporal_status": temporal_status.value,
                        "retrieval_time": (
                            times["retrieval_time"] or datetime.now(UTC)
                        ).isoformat(),
                        "asserted_publication_time": _iso(times["asserted_publication_time"]),
                        "commit_time": _iso(times["commit_time"]),
                        "archive_capture_time": _iso(times["archive_capture_time"]),
                        "verified_introduction_time": _iso(times["verified_introduction_time"]),
                        "supporting_evidence_note": times["note"],
                    },
                    snapshot=snapshot.model_dump(mode="json"),
                )
                self.db.add(model)
                cand.status = (
                    "verified" if claim_status == ClaimStatus.VERIFIED else claim_status.value
                )
                created += 1
                await self.db.flush()
                await self._emit(
                    inv,
                    EventType.VERIFICATION_COMPLETED,
                    VerificationCompletedPayload(
                        item_version_id=item.id,
                        external_id=item.external_id,
                        exposure_type=result.exposure_type,
                        claim_status=claim_status,
                        task_identity=result.task_identity,
                        answer_match=result.answer_match,
                        temporal_status=temporal_status,
                    ).model_dump(mode="json"),
                )

        if inv.status == InvestigationStatus.AWAITING_REVIEW.value:
            inv.substatus = "verification_completed_pending_review"
            inv.updated_at = datetime.now(UTC)
        self._audit(
            actor,
            "verify_investigation",
            "investigation",
            inv.id,
            correlation_id,
            {"findings_created": created, "grader_version": GRADER_VERSION},
        )
        await self.db.commit()

        counts = await self._status_counts(inv.id, actor.workspace_id)
        return {
            "investigation_id": inv.id,
            "findings_created": created,
            "grader_version": GRADER_VERSION,
            "normalization_version": NORMALIZATION_VERSION,
            "claim_status_counts": counts,
        }

    async def _status_counts(self, investigation_id: str, workspace_id: str) -> dict[str, int]:
        stmt = (
            select(FindingModel.claim_status, func.count())
            .where(
                FindingModel.investigation_id == investigation_id,
                FindingModel.workspace_id == workspace_id,
            )
            .group_by(FindingModel.claim_status)
        )
        return {k: v for k, v in (await self.db.execute(stmt)).all()}

    # ------------------------------------------------------------------ findings
    async def list_findings(
        self,
        investigation_id: str,
        actor: AuthenticatedActor,
        page: int,
        size: int,
        exposure_type=None,
        temporal_status=None,
        claim_status=None,
    ) -> FindingListResponse:
        await self._load_investigation(investigation_id, actor)
        conds = [
            FindingModel.investigation_id == investigation_id,
            FindingModel.workspace_id == actor.workspace_id,
        ]
        if exposure_type:
            conds.append(FindingModel.exposure_type == exposure_type.value)
        if temporal_status:
            conds.append(FindingModel.temporal_status == temporal_status.value)
        if claim_status:
            conds.append(FindingModel.claim_status == claim_status.value)
        total = (
            await self.db.execute(select(func.count()).select_from(FindingModel).where(*conds))
        ).scalar() or 0
        rows = (
            (
                await self.db.execute(
                    select(FindingModel)
                    .where(*conds)
                    .order_by(FindingModel.external_id, FindingModel.created_at)
                    .offset((page - 1) * size)
                    .limit(size)
                )
            )
            .scalars()
            .all()
        )
        return FindingListResponse(
            items=[finding_to_view(r) for r in rows], total=total, page=page, size=size
        )

    async def get_finding(self, finding_id: str, actor: AuthenticatedActor) -> FindingView:
        return finding_to_view(await self._load_finding(finding_id, actor))

    async def _load_finding(self, finding_id: str, actor: AuthenticatedActor) -> FindingModel:
        f = (
            await self.db.execute(
                select(FindingModel).where(
                    FindingModel.id == finding_id, FindingModel.workspace_id == actor.workspace_id
                )
            )
        ).scalar_one_or_none()
        if f is None:
            raise _not_found("Finding", finding_id)
        return f

    # ------------------------------------------------------------------- reviews
    async def submit_review(
        self,
        finding_id: str,
        payload: ReviewCreateRequest,
        actor: AuthenticatedActor,
        correlation_id: str,
    ) -> ReviewDecision:
        f = await self._load_finding(finding_id, actor)
        if payload.action == ReviewAction.CONFIRM and (
            f.snapshot.get("availability") != SnapshotAvailability.AVAILABLE.value
            or f.task_identity in ("different",)
        ):
            raise HTTPException(
                status_code=422,
                detail="Cannot confirm: required evidence (available snapshot with matching task) is missing.",
            )
        current_version = f.version
        new_version = payload.expected_version + 1
        now = datetime.now(UTC)
        res = await self.db.execute(
            update(FindingModel)
            .where(
                FindingModel.id == f.id,
                FindingModel.workspace_id == actor.workspace_id,
                FindingModel.version == payload.expected_version,
            )
            .values(
                version=new_version,
                claim_status=REVIEW_TO_CLAIM[payload.action].value,
                current_reviewer_decision=payload.action.value,
                updated_at=now,
            )
        )
        if res.rowcount != 1:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Version conflict: expected version {payload.expected_version}, "
                    f"finding is at version {current_version}. Reload and retry."
                ),
            )
        decision = ReviewDecisionModel(
            id=f"rev_{uuid4().hex[:16]}",
            workspace_id=actor.workspace_id,
            finding_id=f.id,
            expected_version=payload.expected_version,
            new_version=new_version,
            reviewer_id=actor.user_id,
            action=payload.action.value,
            reason=payload.reason,
            reviewed_at=now,
        )
        self.db.add(decision)
        self._audit(
            actor,
            "review_finding",
            "finding",
            f.id,
            correlation_id,
            {"action": payload.action.value, "new_version": new_version},
        )
        await self.db.commit()
        return _decision_view(decision)

    async def review_history(
        self, finding_id: str, actor: AuthenticatedActor
    ) -> ReviewHistoryResponse:
        f = await self._load_finding(finding_id, actor)
        rows = (
            (
                await self.db.execute(
                    select(ReviewDecisionModel)
                    .where(
                        ReviewDecisionModel.finding_id == f.id,
                        ReviewDecisionModel.workspace_id == actor.workspace_id,
                    )
                    .order_by(ReviewDecisionModel.new_version)
                )
            )
            .scalars()
            .all()
        )
        return ReviewHistoryResponse(finding_id=f.id, decisions=[_decision_view(r) for r in rows])

    # ------------------------------------------------------------------- reports
    async def create_report(
        self, investigation_id: str, actor: AuthenticatedActor, correlation_id: str
    ) -> ReportStatusResponse:
        """Freeze current findings + decisions into an immutable, versioned report."""
        inv = await self._load_investigation(investigation_id, actor)
        policy = await self.db.get(EvaluationPolicyVersionModel, inv.policy_version_id)
        n_existing = (
            await self.db.execute(
                select(func.count())
                .select_from(ReportModel)
                .where(
                    ReportModel.investigation_id == inv.id,
                    ReportModel.workspace_id == actor.workspace_id,
                )
            )
        ).scalar() or 0
        report = ReportModel(
            id=f"rpt_{uuid4().hex[:16]}",
            workspace_id=actor.workspace_id,
            investigation_id=inv.id,
            report_version=f"R-{n_existing + 1:03d}",
            status=ReportStatus.GENERATING.value,
            actor_id=actor.user_id,
            frozen_at=datetime.now(UTC),
        )
        self.db.add(report)
        await self.db.flush()
        try:
            content = await self._build_report_content(inv, policy, report)
            body = json.dumps(content, sort_keys=True, default=str)
            report.content = json.loads(body)
            report.content_sha256 = hashlib.sha256(body.encode()).hexdigest()
            report.status = ReportStatus.COMPLETED.value
            report.completed_at = datetime.now(UTC)
        except Exception as err:  # export failure must not change investigation state
            logger.exception("Report generation failed for %s", inv.id)
            report.status = ReportStatus.FAILED.value
            report.error_message = type(err).__name__
        self._audit(
            actor,
            "create_report",
            "report",
            report.id,
            correlation_id,
            {"report_version": report.report_version, "status": report.status},
        )
        await self.db.commit()
        return self._report_status(report)

    async def _build_report_content(self, inv, policy, report) -> dict:
        findings = (
            (
                await self.db.execute(
                    select(FindingModel)
                    .where(
                        FindingModel.investigation_id == inv.id,
                        FindingModel.workspace_id == inv.workspace_id,
                    )
                    .order_by(FindingModel.external_id, FindingModel.created_at)
                )
            )
            .scalars()
            .all()
        )
        decisions = (
            (
                await self.db.execute(
                    select(ReviewDecisionModel)
                    .where(
                        ReviewDecisionModel.workspace_id == inv.workspace_id,
                        ReviewDecisionModel.finding_id.in_([f.id for f in findings] or [""]),
                    )
                    .order_by(ReviewDecisionModel.reviewed_at)
                )
            )
            .scalars()
            .all()
        )
        by_finding: dict[str, list] = {}
        for d in decisions:
            by_finding.setdefault(d.finding_id, []).append(
                _decision_view(d).model_dump(mode="json")
            )

        verified = [f for f in findings if f.claim_status == ClaimStatus.VERIFIED.value]
        counts = ReportSummaryCounts(
            total_items=inv.total_items,
            verified_claims_count=len(verified),
            rejected_claims_count=sum(
                f.claim_status == ClaimStatus.REJECTED.value for f in findings
            ),
            needs_review_count=sum(
                f.claim_status in (ClaimStatus.NEEDS_REVIEW.value, ClaimStatus.CANDIDATE.value)
                for f in findings
            ),
            timing_unknown_count=sum(
                f.temporal_status
                in (TemporalStatus.UNKNOWN.value, TemporalStatus.OBSERVED_POST_CUTOFF.value)
                for f in verified
            ),
            verified_pre_cutoff_count=sum(
                f.temporal_status == TemporalStatus.VERIFIED_PRE_CUTOFF.value for f in verified
            ),
        )
        # Per-item coverage: how many sources were actually retrieved for each item.
        cov_rows = (
            await self.db.execute(
                select(
                    ItemVersionModel.external_id,
                    InvestigationTaskModel.status,
                    func.count(CandidateSourceModel.id),
                )
                .join(
                    ItemVersionModel, ItemVersionModel.id == InvestigationTaskModel.item_version_id
                )
                .outerjoin(
                    CandidateSourceModel, CandidateSourceModel.task_id == InvestigationTaskModel.id
                )
                .where(
                    InvestigationTaskModel.investigation_id == inv.id,
                    InvestigationTaskModel.workspace_id == inv.workspace_id,
                )
                .group_by(ItemVersionModel.external_id, InvestigationTaskModel.status)
                .order_by(ItemVersionModel.external_id)
            )
        ).all()
        coverage = [
            {"external_id": ext, "task_status": st, "sources_retrieved": n}
            for ext, st, n in cov_rows
        ]
        no_sources = [c["external_id"] for c in coverage if c["sources_retrieved"] == 0]

        limitations = []
        if inv.status in (
            InvestigationStatus.CANCELLED.value,
            InvestigationStatus.BUDGET_EXHAUSTED.value,
        ):
            limitations.append(
                f"Partial coverage: investigation ended as '{inv.status}' after "
                f"{inv.investigated_items}/{inv.total_items} items."
            )
        elif inv.is_partial:
            limitations.append(
                "Partial coverage: the investigation budget ran out, so some items received "
                "fewer searches or fetches than the policy allows."
            )
        if no_sources:
            limitations.append(
                f"No sources were retrieved for {len(no_sources)} item(s): "
                f"{', '.join(no_sources)}. Absence of findings for these items is not "
                "evidence of absence of exposure."
            )
        if counts.timing_unknown_count:
            limitations.append(
                f"{counts.timing_unknown_count} verified finding(s) were observed after the cutoff "
                "or have unknown timing; they show exposure, not pre-cutoff contamination."
            )
        if counts.needs_review_count:
            limitations.append(
                f"{counts.needs_review_count} claim(s) remain unresolved and need review."
            )
        limitations.append(
            "Exposure findings show benchmark content is publicly retrievable; they do not prove "
            "any model was trained on it or that scores are inflated."
        )
        items_with_exposure = sorted({f.external_id for f in verified})
        return {
            "report_id": report.id,
            "report_version": report.report_version,
            "investigation_id": inv.id,
            "benchmark_version_id": inv.benchmark_version_id,
            "policy_version_id": inv.policy_version_id,
            "frozen_at": report.frozen_at.isoformat(),
            "methodology": {
                "methodology_version": METHODOLOGY_VERSION,
                "grader_version": GRADER_VERSION,
                "normalization_version": NORMALIZATION_VERSION,
                "extraction_version": EXTRACTION_VERSION,
                "dimensions": ["exposure_type", "task_identity", "answer_match", "temporal_status"],
            },
            "policy": {
                "name": policy.name if policy else None,
                "data_classification": policy.data_classification if policy else None,
                "evaluation_cutoff": policy.evaluation_cutoff.isoformat() if policy else None,
                "max_queries_per_item": policy.max_queries_per_item if policy else None,
                "max_fetches_per_item": policy.max_fetches_per_item if policy else None,
                "cost_ceiling_usd": policy.cost_ceiling_usd if policy else None,
            },
            "scope": {
                "investigation_status": inv.status,
                "total_items": inv.total_items,
                "investigated_items": inv.investigated_items,
                "is_partial": inv.is_partial,
            },
            "summary_counts": counts.model_dump(mode="json"),
            "items_with_verified_exposure": items_with_exposure,
            "coverage": coverage,
            "limitations": limitations,
            "findings": [
                {
                    **finding_to_view(f).model_dump(mode="json"),
                    "auto_claim_status": f.auto_claim_status,
                    "review_history": by_finding.get(f.id, []),
                }
                for f in findings
            ],
        }

    def _report_status(self, r: ReportModel) -> ReportStatusResponse:
        done = r.status == ReportStatus.COMPLETED.value
        return ReportStatusResponse(
            report_id=r.id,
            report_version=r.report_version,
            status=ReportStatus(r.status),
            download_url=f"/api/v1/reports/{r.id}/download" if done else None,
            authorized_until=(datetime.now(UTC) + REPORT_DOWNLOAD_TTL) if done else None,
        )

    async def _load_report(self, report_id: str, actor: AuthenticatedActor) -> ReportModel:
        r = (
            await self.db.execute(
                select(ReportModel).where(
                    ReportModel.id == report_id, ReportModel.workspace_id == actor.workspace_id
                )
            )
        ).scalar_one_or_none()
        if r is None:
            raise _not_found("Report", report_id)
        return r

    async def get_report(self, report_id: str, actor: AuthenticatedActor) -> ReportStatusResponse:
        return self._report_status(await self._load_report(report_id, actor))

    async def download_report(self, report_id: str, actor: AuthenticatedActor) -> dict:
        r = await self._load_report(report_id, actor)
        if r.status != ReportStatus.COMPLETED.value:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail=f"Report is '{r.status}'."
            )
        return {**r.content, "content_sha256": r.content_sha256}


def _iso(dt):
    return dt.isoformat() if dt else None


def _decision_view(d: ReviewDecisionModel) -> ReviewDecision:
    return ReviewDecision(
        decision_id=d.id,
        finding_id=d.finding_id,
        expected_version=d.expected_version,
        new_version=d.new_version,
        reviewer_id=d.reviewer_id,
        action=ReviewAction(d.action),
        reason=d.reason,
        reviewed_at=d.reviewed_at,
    )
