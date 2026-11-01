"""Durable PostgreSQL-backed job worker with heartbeats, leases, and fencing tokens.

Key Architectural Guarantees:
- Concurrency via PostgreSQL SELECT ... FOR UPDATE SKIP LOCKED.
- Distributed fencing: each lease claim monotonically increments fencing_token.
- Stale commit rejection: any attempt by an expired or restarted worker to write with an
  outdated fencing token is rejected atomically.
- Crash and restart recovery: expired leases can be claimed by active workers.
- Preserves partial candidate evidence on cancellation or interruption.
- Emits monotonic sequence events to operational_events.
"""

import logging
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from benchshield.domain.enums import (
    EventType,
    InvestigationStatus,
    SourceFamily,
)
from benchshield.domain.models.events import (
    BudgetUpdatedPayload,
    CandidateDiscoveredPayload,
    InvestigationCompletedPayload,
    ItemInvestigationStartedPayload,
)
from benchshield.orchestration.benchmark_profiler import BenchmarkProfiler
from benchshield.orchestration.mirror_discovery import MirrorDiscovery
from benchshield.orchestration.query_planner import QueryPlanner
from benchshield.persistence.models import (
    CandidateSourceModel,
    EvaluationPolicyVersionModel,
    InvestigationHypothesisModel,
    InvestigationModel,
    InvestigationTaskModel,
    ItemVersionModel,
    OperationalEventModel,
    SearchExecutionModel,
    TaskAttemptModel,
)
from benchshield.services.budget_service import BudgetExhaustedException, BudgetService
from benchshield.web.adapter_interface import FetchAdapter, SearchAdapter, SearchResultItem

logger = logging.getLogger("benchshield.workers.durable")


class StaleTaskCommitError(Exception):
    """Raised when a worker attempts to commit results with a stale fencing token."""


class DurableTaskWorker:
    """Worker processing item-level discovery tasks with durable PostgreSQL leases."""

    def __init__(
        self,
        worker_id: str,
        db: AsyncSession,
        search_adapter: SearchAdapter,
        fetch_adapter: FetchAdapter,
        lease_seconds: int = 60,
    ):
        self.worker_id = worker_id
        self.db = db
        self.search_adapter = search_adapter
        self.fetch_adapter = fetch_adapter
        self.lease_seconds = lease_seconds
        self.budget_service = BudgetService(db)

    async def emit_event(
        self,
        investigation: InvestigationModel,
        event_type: EventType,
        payload_dict: dict,
    ) -> OperationalEventModel:
        """Emit a sequenced event into the durable operational_events outbox."""
        # Calculate next monotonic sequence number for this investigation
        seq_stmt = select(
            func.coalesce(func.max(OperationalEventModel.sequence_number), 0) + 1
        ).where(OperationalEventModel.investigation_id == investigation.id)
        next_seq = (await self.db.execute(seq_stmt)).scalar() or 1

        event = OperationalEventModel(
            id=f"evt_{uuid4().hex[:16]}",
            workspace_id=investigation.workspace_id,
            investigation_id=investigation.id,
            sequence_number=next_seq,
            event_type=event_type.value,
            payload=payload_dict,
        )
        self.db.add(event)
        await self.db.flush()
        return event

    async def claim_next_task(
        self,
        workspace_id: str | None = None,
        investigation_id: str | None = None,
    ) -> tuple[InvestigationTaskModel, int] | None:
        """Claim next pending or expired task using FOR UPDATE SKIP LOCKED with fencing token bump."""
        now = datetime.now(UTC)

        query = (
            select(InvestigationTaskModel)
            .where(
                (InvestigationTaskModel.status == "pending")
                | (
                    (InvestigationTaskModel.status == "running")
                    & (InvestigationTaskModel.lease_expires_at < now)
                )
            )
            .order_by(InvestigationTaskModel.created_at.asc())
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if workspace_id:
            query = query.where(InvestigationTaskModel.workspace_id == workspace_id)
        if investigation_id:
            query = query.where(InvestigationTaskModel.investigation_id == investigation_id)

        result = await self.db.execute(query)
        task = result.scalar_one_or_none()
        if not task:
            return None

        # Bump fencing token monotonically
        task.fencing_token += 1
        task.claimed_by = self.worker_id
        task.status = "running"
        task.current_attempt += 1
        task.lease_expires_at = now + timedelta(seconds=self.lease_seconds)
        task.updated_at = now

        # Record attempt
        attempt = TaskAttemptModel(
            id=f"att_{uuid4().hex[:16]}",
            workspace_id=task.workspace_id,
            task_id=task.id,
            attempt_number=task.current_attempt,
            worker_id=self.worker_id,
            fencing_token=task.fencing_token,
            started_at=now,
            heartbeat_at=now,
            status="running",
        )
        self.db.add(attempt)
        await self.db.flush()

        return task, task.fencing_token

    async def heartbeat(self, task_id: str, fencing_token: int) -> bool:
        """Extend lease if fencing token still matches."""
        now = datetime.now(UTC)
        stmt = (
            select(InvestigationTaskModel)
            .where(
                InvestigationTaskModel.id == task_id,
                InvestigationTaskModel.fencing_token == fencing_token,
                InvestigationTaskModel.status == "running",
            )
            .with_for_update()
        )
        result = await self.db.execute(stmt)
        task = result.scalar_one_or_none()
        if not task:
            return False

        task.lease_expires_at = now + timedelta(seconds=self.lease_seconds)
        task.updated_at = now
        await self.db.flush()
        return True

    async def process_task(self, task: InvestigationTaskModel, fencing_token: int) -> bool:
        """Execute discovery workflow for a single item task."""
        # 1. Load investigation, item, and policy
        inv = await self.db.get(InvestigationModel, task.investigation_id)
        if not inv:
            return False

        # If investigation is cancelled or terminal, stop immediately
        if inv.status in (InvestigationStatus.CANCELLED, InvestigationStatus.FAILED):
            task.status = "cancelled"
            await self.db.flush()
            return False

        policy = await self.db.get(EvaluationPolicyVersionModel, inv.policy_version_id)
        item = await self.db.get(ItemVersionModel, task.item_version_id)
        if not policy or not item:
            task.status = "failed"
            task.error_message = "Missing item or policy"
            await self.db.flush()
            return False

        # 2. Emit ItemInvestigationStarted event
        await self.emit_event(
            inv,
            EventType.ITEM_INVESTIGATION_STARTED,
            ItemInvestigationStartedPayload(
                item_version_id=item.id,
                external_id=item.external_id,
                item_index=task.item_index,
            ).model_dump(mode="json"),
        )

        # 3. Profile item using public fields only
        profile = BenchmarkProfiler.profile_item(item)

        # 4. Plan hypotheses
        planned_hypotheses = QueryPlanner.plan_hypotheses(profile, policy)
        for hyp in planned_hypotheses:
            hyp_model = InvestigationHypothesisModel(
                id=f"hyp_{uuid4().hex[:16]}",
                workspace_id=task.workspace_id,
                investigation_id=task.investigation_id,
                task_id=task.id,
                hypothesis_type=hyp.hypothesis_type,
                rationale=hyp.rationale,
                planned_queries=hyp.queries,
                status="planned",
            )
            self.db.add(hyp_model)
        await self.db.flush()

        # 5. Execute searches and candidate retrieval bounded by budget
        already_fetched: set[str] = set()
        candidate_count = 0

        for hyp in planned_hypotheses:
            # Check cancellation between operations
            await self.db.refresh(inv)
            if inv.status == InvestigationStatus.CANCELLED:
                task.status = "cancelled"
                await self.db.flush()
                return False

            for query_str in hyp.queries:
                # Heartbeat before external call
                if not await self.heartbeat(task.id, fencing_token):
                    raise StaleTaskCommitError("Heartbeat failed: lease expired or reclaimed.")

                # Reserve query budget
                try:
                    q_res = await self.budget_service.reserve_budget(
                        inv, "queries", amount=1, task_id=task.id
                    )
                except BudgetExhaustedException:
                    logger.warning("Query budget exhausted for investigation %s", inv.id)
                    inv.substatus = "budget_exhausted"
                    break

                # Search
                search_results: list[SearchResultItem] = []
                try:
                    search_results = await self.search_adapter.search(query_str, max_results=5)
                    await self.budget_service.reconcile_usage(q_res, used_amount=1)
                except Exception as err:
                    logger.error("Search query execution failed: %s", err)
                    await self.budget_service.release_reservation(q_res)
                    continue

                # Record SearchExecutionModel
                search_exec = SearchExecutionModel(
                    id=f"sexec_{uuid4().hex[:16]}",
                    workspace_id=task.workspace_id,
                    investigation_id=task.investigation_id,
                    task_id=task.id,
                    specialist="query_planner",
                    query=query_str,
                    provider="web",
                    result_count=len(search_results),
                    results_summary=[{"url": r.url, "title": r.title} for r in search_results],
                    cost_cents=0,
                    latency_ms=100,
                )
                self.db.add(search_exec)
                await self.db.flush()

                # Select candidate URLs for fetching
                urls_to_fetch = MirrorDiscovery.select_candidate_urls(
                    search_results,
                    already_fetched=already_fetched,
                    max_fetches=policy.max_fetches_per_item or 5,
                )

                for url in urls_to_fetch:
                    already_fetched.add(url)

                    # Reserve fetch budget
                    try:
                        f_res = await self.budget_service.reserve_budget(
                            inv, "fetches", amount=1, task_id=task.id
                        )
                    except BudgetExhaustedException:
                        logger.warning("Fetch budget exhausted for investigation %s", inv.id)
                        inv.substatus = "budget_exhausted"
                        break

                    try:
                        snapshot = await self.fetch_adapter.fetch(url, max_bytes=500_000)
                        await self.budget_service.reconcile_usage(f_res, used_amount=1)
                    except Exception as err:
                        logger.warning("Fetch failed for %s: %s", url, err)
                        await self.budget_service.release_reservation(f_res)
                        continue

                    # Determine source family
                    family = SourceFamily.WEB_SEARCH
                    if "github.com" in url or "huggingface.co" in url:
                        family = SourceFamily.CODE_REPOSITORY
                    elif "arxiv.org" in url or "openreview.net" in url:
                        family = SourceFamily.ACADEMIC_ARCHIVE

                    # Save candidate source with honest status="candidate"
                    candidate = CandidateSourceModel(
                        id=f"src_{uuid4().hex[:16]}",
                        workspace_id=task.workspace_id,
                        investigation_id=task.investigation_id,
                        task_id=task.id,
                        url=snapshot.final_url or url,
                        source_domain=snapshot.title or "unknown",
                        title=snapshot.title,
                        # Bounded evidence text for the verifier; clients only ever see a short redacted preview.
                        snapshot_content=snapshot.content[:200_000],
                        content_sha256=snapshot.content_sha256,
                        status="candidate",
                        evidence_metadata={
                            "content_length": snapshot.size_bytes,
                            "media_type": snapshot.media_type,
                        },
                    )
                    self.db.add(candidate)
                    await self.db.flush()
                    candidate_count += 1

                    # Emit CandidateDiscovered event
                    await self.emit_event(
                        inv,
                        EventType.CANDIDATE_DISCOVERED,
                        CandidateDiscoveredPayload(
                            item_version_id=item.id,
                            external_id=item.external_id,
                            source_url=snapshot.final_url or url,
                            source_family=family,
                        ).model_dump(mode="json"),
                    )

        # 6. Commit task completion with fencing token verification
        await self._commit_task_completion(task.id, fencing_token)

        # 7. Update investigation counters and check overall completion
        await self._check_investigation_progress(inv)
        return True

    async def _commit_task_completion(self, task_id: str, fencing_token: int) -> None:
        """Verify fencing token and mark task completed."""
        stmt = (
            select(InvestigationTaskModel)
            .where(InvestigationTaskModel.id == task_id)
            .with_for_update()
        )
        task = (await self.db.execute(stmt)).scalar_one_or_none()
        if not task:
            raise StaleTaskCommitError(f"Task '{task_id}' no longer exists.")

        # STRICT FENCING CHECK: prevent zombie or superseded workers from committing
        if task.fencing_token != fencing_token:
            raise StaleTaskCommitError(
                f"Stale commit rejected: task fencing token {task.fencing_token} != worker token {fencing_token}."
            )

        task.status = "completed"
        task.updated_at = datetime.now(UTC)

        # Mark attempt succeeded
        att_stmt = (
            select(TaskAttemptModel)
            .where(
                TaskAttemptModel.task_id == task_id,
                TaskAttemptModel.fencing_token == fencing_token,
            )
            .with_for_update()
        )
        attempt = (await self.db.execute(att_stmt)).scalar_one_or_none()
        if attempt:
            attempt.status = "succeeded"
            attempt.finished_at = datetime.now(UTC)

        await self.db.flush()

    async def _check_investigation_progress(self, inv: InvestigationModel) -> None:
        """Update investigated item count, budget event, and mark completed if all items done."""
        # Count completed tasks
        completed_stmt = select(func.count(InvestigationTaskModel.id)).where(
            InvestigationTaskModel.investigation_id == inv.id,
            InvestigationTaskModel.status == "completed",
        )
        completed_count = (await self.db.execute(completed_stmt)).scalar() or 0
        inv.investigated_items = completed_count

        # Check pending/running tasks
        remaining_stmt = select(func.count(InvestigationTaskModel.id)).where(
            InvestigationTaskModel.investigation_id == inv.id,
            InvestigationTaskModel.status.in_(["pending", "running"]),
        )
        remaining_count = (await self.db.execute(remaining_stmt)).scalar() or 0

        # Update budgets & emit BudgetUpdated event
        budgets = await self.budget_service.get_budget_summary(inv)
        await self.emit_event(
            inv,
            EventType.BUDGET_UPDATED,
            BudgetUpdatedPayload(
                used_queries=budgets.used_queries,
                max_queries=budgets.max_queries,
                used_fetches=budgets.used_fetches,
                max_fetches=budgets.max_fetches,
                used_cost_usd=budgets.used_cost_usd,
                cost_ceiling_usd=budgets.cost_ceiling_usd,
            ).model_dump(mode="json"),
        )

        if remaining_count == 0 and inv.status in (
            InvestigationStatus.QUEUED,
            InvestigationStatus.DISCOVERING,
        ):
            # All items completed! Transition to awaiting_review with honest discovery substatus
            now = datetime.now(UTC)
            inv.status = InvestigationStatus.AWAITING_REVIEW
            inv.substatus = "discovery_completed_pending_verification"
            inv.completed_at = now
            inv.updated_at = now

            # Count candidate sources
            src_count_stmt = select(func.count(CandidateSourceModel.id)).where(
                CandidateSourceModel.investigation_id == inv.id
            )
            sources_count = (await self.db.execute(src_count_stmt)).scalar() or 0

            await self.emit_event(
                inv,
                EventType.INVESTIGATION_COMPLETED,
                InvestigationCompletedPayload(
                    status=InvestigationStatus.AWAITING_REVIEW,
                    total_items=inv.total_items,
                    investigated_items=inv.investigated_items,
                    findings_count=sources_count,
                    is_partial=inv.is_partial,
                ).model_dump(mode="json"),
            )

        await self.db.flush()
