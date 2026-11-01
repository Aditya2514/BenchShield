"""Experiment service orchestrating controlled adversarial runs and result aggregation.

Guarantees (Blueprint B4.1-B4.6):
- Requires frozen discovery before launching experiments.
- Fresh attacker execution context: zero access to vault or discovery findings.
- Grader runs via verifier role against decrypted gold answers without leaking answers.
- Strict no-fallback rule: interrupted runs stay incomplete.
- Explicit denominators for aggregated counts.
"""

import logging
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from benchshield.api.auth import AuthenticatedActor
from benchshield.config import Settings, get_settings
from benchshield.domain.enums import (
    AttributionLevel,
    ExperimentCondition,
    ExperimentRunStatus,
    GraderOutcome,
    InvestigationStatus,
    PolicyCompliance,
)
from benchshield.domain.models.experiments import (
    AdversarialRun,
    ExperimentConfig,
    ExperimentCreateRequest,
    ExperimentResultsResponse,
    ObservableToolCall,
)
from benchshield.experiments.attacker import FakeAttackerAdapter
from benchshield.experiments.evaluator import classify_attribution, grade_adversarial_output
from benchshield.persistence.database import get_verifier_session_factory
from benchshield.persistence.models import (
    AdversarialRunModel,
    AuditEventModel,
    BenchmarkModel,
    EvaluationPolicyVersionModel,
    ExperimentModel,
    InvestigationModel,
    ItemVersionModel,
)
from benchshield.services.vault_service import TrustedVaultReader

logger = logging.getLogger("benchshield.services.experiment")


class ExperimentService:
    """Service orchestrating controlled attacker experiments."""

    def __init__(self, db: AsyncSession, settings: Settings | None = None):
        self.db = db
        self.settings = settings or get_settings()

    async def launch_experiment(
        self,
        investigation_id: str,
        payload: ExperimentCreateRequest,
        actor: AuthenticatedActor,
        correlation_id: str = "req_anon",
        attacker_adapter: FakeAttackerAdapter | None = None,
    ) -> ExperimentConfig:
        """Launch pinned optional attacker experiments following completed investigation."""
        # 1. Tenant boundary check
        stmt = select(InvestigationModel).where(
            InvestigationModel.id == investigation_id,
            InvestigationModel.workspace_id == actor.workspace_id,
        )
        inv = (await self.db.execute(stmt)).scalar_one_or_none()
        if not inv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Investigation '{investigation_id}' not found in workspace '{actor.workspace_id}'.",
            )

        # 2. Verify investigation is in a completed or frozen state
        valid_states = (
            InvestigationStatus.COMPLETED.value,
            InvestigationStatus.AWAITING_REVIEW.value,
        )
        if inv.status not in valid_states and not inv.is_partial:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Cannot launch experiments on investigation in status '{inv.status}'. "
                    "Discovery findings must be completed or frozen before running experiments."
                ),
            )

        # 3. Load policy and benchmark
        policy = await self.db.get(EvaluationPolicyVersionModel, inv.policy_version_id)
        if not policy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Policy version '{inv.policy_version_id}' not found.",
            )

        # Load benchmark record for context label
        bm_stmt = (
            select(BenchmarkModel)
            .join(
                ItemVersionModel,
                ItemVersionModel.benchmark_version_id == inv.benchmark_version_id,
            )
            .where(BenchmarkModel.workspace_id == actor.workspace_id)
        )
        bm = (await self.db.execute(bm_stmt)).scalars().first()
        benchmark_name = bm.name if bm else "Benchmark"

        # 4. Load benchmark items
        items_stmt = (
            select(ItemVersionModel)
            .where(
                ItemVersionModel.benchmark_version_id == inv.benchmark_version_id,
                ItemVersionModel.workspace_id == actor.workspace_id,
            )
            .order_by(ItemVersionModel.id)
        )
        items = (await self.db.execute(items_stmt)).scalars().all()
        if not items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No items found for benchmark version '{inv.benchmark_version_id}'.",
            )

        # 5. Create pinned ExperimentConfig
        exp_id = f"exp_{uuid4().hex[:16]}"
        now = datetime.now(UTC)

        config_model = ExperimentConfig(
            experiment_id=exp_id,
            investigation_id=inv.id,
            benchmark_version_id=inv.benchmark_version_id,
            policy_version_id=policy.id,
            conditions=payload.conditions,
            provider_id=payload.provider_id,
            model_identifier=payload.model_identifier,
            model_revision=payload.model_revision,
            prompt_version=payload.prompt_version,
            generation_settings={"temperature": 0.0, "max_tokens": 1000},
            tool_policy={
                "allowed_tools": policy.allowed_tools,
                "max_fetches": policy.max_fetches_per_item,
            },
            reasoning_budget=payload.reasoning_budget,
            grader_version="grader_v1.0",
            repetitions=1,
            created_at=now,
        )

        exp_entity = ExperimentModel(
            id=exp_id,
            workspace_id=actor.workspace_id,
            investigation_id=inv.id,
            benchmark_version_id=inv.benchmark_version_id,
            policy_version_id=policy.id,
            status="running",
            config=config_model.model_dump(mode="json"),
            created_at=now,
            updated_at=now,
        )
        self.db.add(exp_entity)
        await self.db.flush()

        # 6. Instantiate Attacker and Trusted Verifier Vault Reader
        adapter = attacker_adapter or FakeAttackerAdapter()
        verifier_factory = get_verifier_session_factory(self.settings)

        async with verifier_factory() as vsession:
            vault = TrustedVaultReader(vsession, settings=self.settings)

            # 7. Execute runs for each item in each condition
            for item in items:
                # Retrieve gold answer once for grading (never exposed to attacker)
                gold_text, gold_choice_id = await vault.get_protected_answer(
                    item.answer_revision_id, actor.workspace_id
                )

                for condition in payload.conditions:
                    run_id = f"run_{uuid4().hex[:16]}"
                    run_result = await adapter.execute_run(
                        item=item,
                        condition=condition,
                        policy=policy,
                        benchmark_name=benchmark_name,
                    )

                    grader_outcome = GraderOutcome.UNSUPPORTED
                    attribution = AttributionLevel.NONE

                    if run_result.run_status == ExperimentRunStatus.COMPLETED:
                        # Grade output via trusted grader
                        grader_outcome, _ = grade_adversarial_output(
                            task_type=item.task_type,
                            question=item.question,
                            gold_text=gold_text,
                            gold_choice_id=gold_choice_id,
                            choices=item.choices,
                            generated_output=run_result.generated_output,
                        )
                        # Assess causal attribution conservatively
                        attribution = classify_attribution(
                            condition=condition,
                            grader_outcome=grader_outcome,
                            answer_bearing_retrieved=run_result.answer_bearing_content_retrieved,
                        )

                    # Persist AdversarialRunModel
                    run_entity = AdversarialRunModel(
                        id=run_id,
                        workspace_id=actor.workspace_id,
                        experiment_id=exp_id,
                        item_version_id=item.id,
                        condition=condition.value,
                        run_status=run_result.run_status.value,
                        source_discovered=run_result.source_discovered,
                        answer_bearing_content_retrieved=run_result.answer_bearing_content_retrieved,
                        grader_outcome=grader_outcome.value,
                        attribution=attribution.value,
                        policy_compliance=run_result.policy_compliance.value,
                        observable_tool_calls=[
                            c.model_dump(mode="json") for c in run_result.observable_tool_calls
                        ],
                        generated_output=run_result.generated_output,
                        failure_reason=run_result.failure_reason,
                        cost_cents=run_result.cost_cents,
                        latency_ms=run_result.latency_ms,
                        created_at=now,
                    )
                    self.db.add(run_entity)

        exp_entity.status = "completed"
        exp_entity.updated_at = datetime.now(UTC)

        # 8. Audit event
        audit = AuditEventModel(
            id=f"aud_{uuid4().hex[:16]}",
            workspace_id=actor.workspace_id,
            actor_id=actor.user_id,
            action="launch_experiment",
            target_type="experiment",
            target_id=exp_id,
            correlation_id=correlation_id,
            outcome="success",
            details={
                "investigation_id": inv.id,
                "conditions": [c.value for c in payload.conditions],
                "item_count": len(items),
            },
            created_at=now,
        )
        self.db.add(audit)
        await self.db.commit()

        return config_model

    async def get_experiment(
        self,
        experiment_id: str,
        actor: AuthenticatedActor,
    ) -> ExperimentResultsResponse:
        """Retrieve aggregated experiment results with raw observable runs."""
        # 1. Tenant boundary check
        stmt = select(ExperimentModel).where(
            ExperimentModel.id == experiment_id,
            ExperimentModel.workspace_id == actor.workspace_id,
        )
        exp = (await self.db.execute(stmt)).scalar_one_or_none()
        if not exp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Experiment '{experiment_id}' not found in workspace '{actor.workspace_id}'.",
            )

        # 2. Query all runs
        runs_stmt = (
            select(AdversarialRunModel)
            .where(
                AdversarialRunModel.experiment_id == experiment_id,
                AdversarialRunModel.workspace_id == actor.workspace_id,
            )
            .order_by(AdversarialRunModel.created_at.asc())
        )
        run_entities = (await self.db.execute(runs_stmt)).scalars().all()

        runs: list[AdversarialRun] = []
        completed_count = 0
        incomplete_count = 0
        prohibited_count = 0
        correct_count = 0

        for r in run_entities:
            tool_calls = [
                ObservableToolCall.model_validate(tc) for tc in (r.observable_tool_calls or [])
            ]
            run_model = AdversarialRun(
                run_id=r.id,
                experiment_id=r.experiment_id,
                item_version_id=r.item_version_id,
                condition=ExperimentCondition(r.condition),
                run_status=ExperimentRunStatus(r.run_status),
                source_discovered=r.source_discovered,
                answer_bearing_content_retrieved=r.answer_bearing_content_retrieved,
                grader_outcome=GraderOutcome(r.grader_outcome),
                attribution=AttributionLevel(r.attribution),
                policy_compliance=PolicyCompliance(r.policy_compliance),
                observable_tool_calls=tool_calls,
                generated_output=r.generated_output,
                failure_reason=r.failure_reason,
            )
            runs.append(run_model)

            if r.run_status == ExperimentRunStatus.COMPLETED.value:
                completed_count += 1
            else:
                incomplete_count += 1

            if r.policy_compliance == PolicyCompliance.VIOLATED.value:
                prohibited_count += 1

            if r.grader_outcome == GraderOutcome.CORRECT.value:
                correct_count += 1

        return ExperimentResultsResponse(
            experiment_id=exp.id,
            runs=runs,
            completed_runs_count=completed_count,
            incomplete_runs_count=incomplete_count,
            prohibited_retrieval_count=prohibited_count,
            correct_answer_count=correct_count,
        )
