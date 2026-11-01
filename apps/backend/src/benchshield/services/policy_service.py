"""Operational Policy Service handling immutable evaluation policies."""

from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from benchshield.api.auth import AuthenticatedActor
from benchshield.config import Settings, get_settings
from benchshield.domain.enums import DataClassification, RetentionProfile, SourceFamily
from benchshield.domain.models.policies import (
    EvaluationPolicyCreateRequest,
    EvaluationPolicyRecord,
    EvaluationPolicyVersion,
)
from benchshield.persistence.models import AuditEventModel, EvaluationPolicyVersionModel


class PolicyService:
    """Core domain service for evaluation policies."""

    def __init__(self, db: AsyncSession, settings: Settings | None = None):
        self.db = db
        self.settings = settings or get_settings()

    async def create_policy(
        self,
        request: EvaluationPolicyCreateRequest,
        actor: AuthenticatedActor,
        correlation_id: str,
        policy_id: str | None = None,
    ) -> EvaluationPolicyVersion:
        """Create an immutable evaluation policy version."""
        # 1. Enforce B1 Policy Constraint: Confidential external discovery is rejected
        if request.data_classification == DataClassification.CONFIDENTIAL:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Policy blocked: Confidential external discovery is not supported in this release. "
                    "Data classification must be 'public' or 'synthetic'."
                ),
            )

        # 2. Determine policy_id and version_number
        target_policy_id = policy_id or f"pol_{uuid4().hex[:16]}"

        v_stmt = select(func.max(EvaluationPolicyVersionModel.version_number)).where(
            EvaluationPolicyVersionModel.workspace_id == actor.workspace_id,
            EvaluationPolicyVersionModel.policy_id == target_policy_id,
        )
        curr_max = (await self.db.execute(v_stmt)).scalar_one_or_none()
        version_number = (curr_max or 0) + 1

        policy_version_id = f"polv_{uuid4().hex[:16]}"

        # 3. Create database record
        policy_row = EvaluationPolicyVersionModel(
            id=policy_version_id,
            policy_id=target_policy_id,
            workspace_id=actor.workspace_id,
            version_number=version_number,
            name=request.name,
            data_classification=request.data_classification.value,
            allowed_tools=request.allowed_tools,
            allowed_source_classes=[s.value for s in request.allowed_source_classes],
            prohibited_answer_key_access=request.prohibited_answer_key_access,
            benchmark_identification_permitted=request.benchmark_identification_permitted,
            evaluation_cutoff=request.evaluation_cutoff,
            cutoff_timezone=request.cutoff_timezone,
            item_scope=request.item_scope,
            max_queries_per_item=request.max_queries_per_item,
            max_fetches_per_item=request.max_fetches_per_item,
            max_concurrent_discovery_tasks=request.max_concurrent_discovery_tasks,
            deadline_seconds=request.deadline_seconds,
            cost_ceiling_usd=request.cost_ceiling_usd,
            retention_profile=request.retention_profile.value,
            reviewer_identity=request.reviewer_identity,
        )
        self.db.add(policy_row)

        # 4. Audit Event
        audit = AuditEventModel(
            id=f"aud_{uuid4().hex[:16]}",
            workspace_id=actor.workspace_id,
            actor_id=actor.user_id,
            action="policy.created",
            target_type="evaluation_policy_version",
            target_id=policy_version_id,
            correlation_id=correlation_id,
            outcome="success",
            details={
                "policy_id": target_policy_id,
                "version_number": version_number,
                "name": request.name,
            },
        )
        self.db.add(audit)

        await self.db.commit()

        return EvaluationPolicyVersion(
            policy_version_id=policy_row.id,
            policy_id=policy_row.policy_id,
            workspace_id=policy_row.workspace_id,
            name=policy_row.name,
            version_number=policy_row.version_number,
            allowed_tools=policy_row.allowed_tools,
            allowed_source_classes=[SourceFamily(s) for s in policy_row.allowed_source_classes],
            prohibited_answer_key_access=policy_row.prohibited_answer_key_access,
            benchmark_identification_permitted=policy_row.benchmark_identification_permitted,
            evaluation_cutoff=policy_row.evaluation_cutoff,
            cutoff_timezone=policy_row.cutoff_timezone,
            item_scope=policy_row.item_scope,
            max_queries_per_item=policy_row.max_queries_per_item,
            max_fetches_per_item=policy_row.max_fetches_per_item,
            max_concurrent_discovery_tasks=policy_row.max_concurrent_discovery_tasks,
            deadline_seconds=policy_row.deadline_seconds,
            cost_ceiling_usd=policy_row.cost_ceiling_usd,
            data_classification=DataClassification(policy_row.data_classification),
            retention_profile=RetentionProfile(policy_row.retention_profile),
            reviewer_identity=policy_row.reviewer_identity,
            created_at=policy_row.created_at,
        )

    async def get_policy_version(
        self,
        version_id: str,
        actor: AuthenticatedActor,
    ) -> EvaluationPolicyVersion:
        """Retrieve an immutable policy version."""
        stmt = select(EvaluationPolicyVersionModel).where(
            EvaluationPolicyVersionModel.workspace_id == actor.workspace_id,
            EvaluationPolicyVersionModel.id == version_id,
        )
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Policy version '{version_id}' not found in workspace '{actor.workspace_id}'.",
            )

        return EvaluationPolicyVersion(
            policy_version_id=row.id,
            policy_id=row.policy_id,
            workspace_id=row.workspace_id,
            name=row.name,
            version_number=row.version_number,
            allowed_tools=row.allowed_tools,
            allowed_source_classes=[SourceFamily(s) for s in row.allowed_source_classes],
            prohibited_answer_key_access=row.prohibited_answer_key_access,
            benchmark_identification_permitted=row.benchmark_identification_permitted,
            evaluation_cutoff=row.evaluation_cutoff,
            cutoff_timezone=row.cutoff_timezone,
            item_scope=row.item_scope,
            max_queries_per_item=row.max_queries_per_item,
            max_fetches_per_item=row.max_fetches_per_item,
            max_concurrent_discovery_tasks=row.max_concurrent_discovery_tasks,
            deadline_seconds=row.deadline_seconds,
            cost_ceiling_usd=row.cost_ceiling_usd,
            data_classification=DataClassification(row.data_classification),
            retention_profile=RetentionProfile(row.retention_profile),
            reviewer_identity=row.reviewer_identity,
            created_at=row.created_at,
        )

    async def get_policy(
        self,
        policy_id: str,
        actor: AuthenticatedActor,
    ) -> EvaluationPolicyRecord:
        """Retrieve policy entity and latest version ID."""
        stmt = (
            select(EvaluationPolicyVersionModel)
            .where(
                EvaluationPolicyVersionModel.workspace_id == actor.workspace_id,
                EvaluationPolicyVersionModel.policy_id == policy_id,
            )
            .order_by(EvaluationPolicyVersionModel.version_number.desc())
        )
        versions = (await self.db.execute(stmt)).scalars().all()
        if not versions:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Policy '{policy_id}' not found in workspace '{actor.workspace_id}'.",
            )

        latest = versions[0]
        return EvaluationPolicyRecord(
            policy_id=latest.policy_id,
            workspace_id=latest.workspace_id,
            name=latest.name,
            latest_version_id=latest.id,
            version_count=len(versions),
            created_at=versions[-1].created_at,
            updated_at=latest.created_at,
        )
