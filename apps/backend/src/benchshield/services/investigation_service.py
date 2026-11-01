"""Investigation lifecycle service: launch, status query, idempotent cancellation, and SSE streams.

Guarantees:
- Enforces strict tenant workspace scoping at API and database query levels.
- Re-entrant, atomic idempotency tracking.
- Idempotent cancellation preserving partial candidate evidence.
- SSE stream formatting conforming to W3C spec with monotonic Last-Event-ID replay.
"""

import asyncio
import hashlib
import json
import logging
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from benchshield.api.auth import AuthenticatedActor
from benchshield.config import Settings, get_settings
from benchshield.domain.enums import EventType, InvestigationStatus
from benchshield.domain.models.events import (
    InvestigationCancelledPayload,
    InvestigationQueuedPayload,
)
from benchshield.domain.models.investigations import (
    InvestigationCancelRequest,
    InvestigationCancelResponse,
    InvestigationCreateRequest,
    InvestigationLimitations,
    InvestigationStatusResponse,
)
from benchshield.persistence.models import (
    AuditEventModel,
    BenchmarkVersionModel,
    CandidateSourceModel,
    EvaluationPolicyVersionModel,
    InvestigationIdempotencyModel,
    InvestigationModel,
    InvestigationTaskModel,
    ItemVersionModel,
    OperationalEventModel,
)
from benchshield.services.budget_service import BudgetService

logger = logging.getLogger("benchshield.services.investigation")


class InvestigationService:
    """Service orchestrating investigation launches, status, cancellation, and event streams."""

    def __init__(self, db: AsyncSession, settings: Settings | None = None):
        self.db = db
        self.settings = settings or get_settings()
        self.budget_service = BudgetService(db)

    async def launch_investigation(
        self,
        payload: InvestigationCreateRequest,
        actor: AuthenticatedActor,
        correlation_id: str = "req_anon",
        idempotency_key: str | None = None,
    ) -> InvestigationStatusResponse:
        """Validate policy and budget, and launch exposure audit investigation."""
        # 1. Tenant boundary check
        if payload.workspace_id != actor.workspace_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Cannot launch investigation in foreign workspace '{payload.workspace_id}'.",
            )

        # 2. Idempotency handling
        request_hash = hashlib.sha256(
            json.dumps(payload.model_dump(mode="json"), sort_keys=True).encode("utf-8")
        ).hexdigest()

        if idempotency_key:
            stmt = select(InvestigationIdempotencyModel).where(
                InvestigationIdempotencyModel.workspace_id == actor.workspace_id,
                InvestigationIdempotencyModel.idempotency_key == idempotency_key,
                InvestigationIdempotencyModel.operation == "launch_investigation",
            )
            result = await self.db.execute(stmt)
            existing_idemp = result.scalar_one_or_none()

            if existing_idemp:
                if existing_idemp.request_hash != request_hash:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Idempotency key reuse with differing request parameters.",
                    )
                return InvestigationStatusResponse.model_validate(existing_idemp.response_body)

        # 3. Validate benchmark version
        bmv_stmt = select(BenchmarkVersionModel).where(
            BenchmarkVersionModel.id == payload.benchmark_version_id,
            BenchmarkVersionModel.workspace_id == actor.workspace_id,
        )
        bmv = (await self.db.execute(bmv_stmt)).scalar_one_or_none()
        if not bmv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Benchmark version '{payload.benchmark_version_id}' not found.",
            )

        # 4. Validate evaluation policy version
        pol_stmt = select(EvaluationPolicyVersionModel).where(
            EvaluationPolicyVersionModel.id == payload.policy_version_id,
            EvaluationPolicyVersionModel.workspace_id == actor.workspace_id,
        )
        policy = (await self.db.execute(pol_stmt)).scalar_one_or_none()
        if not policy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Policy version '{payload.policy_version_id}' not found.",
            )

        # 5. Fetch items for this benchmark version
        items_stmt = (
            select(ItemVersionModel)
            .where(
                ItemVersionModel.benchmark_version_id == bmv.id,
                ItemVersionModel.workspace_id == actor.workspace_id,
            )
            .order_by(ItemVersionModel.created_at.asc())
        )
        items = (await self.db.execute(items_stmt)).scalars().all()
        if not items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Benchmark version contains no items to investigate.",
            )

        # 6. Initialize Investigation entity
        inv_id = f"inv_{uuid4().hex[:16]}"
        now = datetime.now(UTC)

        budget_cfg = {
            "max_queries": (policy.max_queries_per_item or 3) * len(items),
            "max_fetches": (policy.max_fetches_per_item or 5) * len(items),
            "cost_ceiling_usd": policy.cost_ceiling_usd,
            "max_cost_cents": int(policy.cost_ceiling_usd * 100),
            "deadline_seconds": policy.deadline_seconds,
            "max_concurrent_discovery_tasks": policy.max_concurrent_discovery_tasks,
        }

        inv = InvestigationModel(
            id=inv_id,
            workspace_id=actor.workspace_id,
            benchmark_version_id=bmv.id,
            policy_version_id=policy.id,
            actor_id=actor.user_id,
            status=InvestigationStatus.QUEUED.value,
            substatus="queued",
            is_partial=False,
            total_items=len(items),
            investigated_items=0,
            strategy_version="v1",
            provider_config={"web": "controlled_adapter"},
            budget_config=budget_cfg,
            created_at=now,
            updated_at=now,
        )

        response_model = InvestigationStatusResponse(
            investigation_id=inv.id,
            status=InvestigationStatus.QUEUED,
            is_partial=False,
            total_items=len(items),
            investigated_items=0,
            budgets=await self.budget_service.get_budget_summary(inv),
            limitations=InvestigationLimitations(),
            findings_count=0,
            created_at=now,
            updated_at=now,
        )

        try:
            self.db.add(inv)
            await self.db.flush()

            # 7. Create investigation task for each item
            for idx, item in enumerate(items, start=1):
                task = InvestigationTaskModel(
                    id=f"task_{uuid4().hex[:16]}",
                    workspace_id=actor.workspace_id,
                    investigation_id=inv.id,
                    item_version_id=item.id,
                    item_index=idx,
                    status="pending",
                    current_attempt=0,
                    max_attempts=3,
                    fencing_token=0,
                    created_at=now,
                    updated_at=now,
                )
                self.db.add(task)

            # 8. Emit initial InvestigationQueued operational event
            queued_payload = InvestigationQueuedPayload(
                benchmark_version_id=bmv.id,
                total_items=len(items),
                policy_version_id=policy.id,
            )
            init_event = OperationalEventModel(
                id=f"evt_{uuid4().hex[:16]}",
                workspace_id=actor.workspace_id,
                investigation_id=inv.id,
                sequence_number=1,
                event_type=EventType.INVESTIGATION_QUEUED.value,
                payload=queued_payload.model_dump(mode="json"),
                created_at=now,
            )
            self.db.add(init_event)

            # 9. Audit event
            audit = AuditEventModel(
                id=f"aud_{uuid4().hex[:16]}",
                workspace_id=actor.workspace_id,
                actor_id=actor.user_id,
                action="launch_investigation",
                target_type="investigation",
                target_id=inv.id,
                correlation_id=correlation_id,
                outcome="success",
                details={
                    "benchmark_version_id": bmv.id,
                    "policy_version_id": policy.id,
                    "item_count": len(items),
                },
                created_at=now,
            )
            self.db.add(audit)

            # 10. Record idempotency if requested
            if idempotency_key:
                idemp_rec = InvestigationIdempotencyModel(
                    id=f"idm_{uuid4().hex[:16]}",
                    workspace_id=actor.workspace_id,
                    idempotency_key=idempotency_key,
                    operation="launch_investigation",
                    request_hash=request_hash,
                    investigation_id=inv.id,
                    response_status=202,
                    response_body=response_model.model_dump(mode="json"),
                    created_at=now,
                )
                self.db.add(idemp_rec)

            await self.db.commit()
            return response_model

        except IntegrityError:
            await self.db.rollback()
            if idempotency_key:
                stmt = select(InvestigationIdempotencyModel).where(
                    InvestigationIdempotencyModel.workspace_id == actor.workspace_id,
                    InvestigationIdempotencyModel.idempotency_key == idempotency_key,
                    InvestigationIdempotencyModel.operation == "launch_investigation",
                )
                existing_idemp = (await self.db.execute(stmt)).scalar_one_or_none()
                if existing_idemp:
                    if existing_idemp.request_hash == request_hash:
                        return InvestigationStatusResponse.model_validate(
                            existing_idemp.response_body
                        )
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Idempotency key reuse with differing request parameters.",
                    ) from None
            raise

    async def get_investigation(
        self,
        investigation_id: str,
        actor: AuthenticatedActor,
    ) -> InvestigationStatusResponse:
        """Retrieve investigation status and summary."""
        stmt = select(InvestigationModel).where(
            InvestigationModel.id == investigation_id,
            InvestigationModel.workspace_id == actor.workspace_id,
        )
        inv = (await self.db.execute(stmt)).scalar_one_or_none()
        if not inv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Investigation '{investigation_id}' not found.",
            )

        # Count candidate sources
        src_count_stmt = select(func.count(CandidateSourceModel.id)).where(
            CandidateSourceModel.investigation_id == inv.id
        )
        sources_count = (await self.db.execute(src_count_stmt)).scalar() or 0

        budgets = await self.budget_service.get_budget_summary(inv)

        return InvestigationStatusResponse(
            investigation_id=inv.id,
            status=InvestigationStatus(inv.status),
            is_partial=inv.is_partial,
            total_items=inv.total_items,
            investigated_items=inv.investigated_items,
            budgets=budgets,
            limitations=InvestigationLimitations(),
            findings_count=sources_count,
            created_at=inv.created_at,
            updated_at=inv.updated_at,
        )

    async def cancel_investigation(
        self,
        investigation_id: str,
        payload: InvestigationCancelRequest,
        actor: AuthenticatedActor,
        correlation_id: str = "req_anon",
        idempotency_key: str | None = None,
    ) -> InvestigationCancelResponse:
        """Idempotently cancel an investigation preserving partial candidate findings."""
        stmt = (
            select(InvestigationModel)
            .where(
                InvestigationModel.id == investigation_id,
                InvestigationModel.workspace_id == actor.workspace_id,
            )
            .with_for_update()
        )
        inv = (await self.db.execute(stmt)).scalar_one_or_none()
        if not inv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Investigation '{investigation_id}' not found.",
            )

        now = datetime.now(UTC)

        # If already cancelled, return idempotent confirmation
        if inv.status == InvestigationStatus.CANCELLED.value:
            return InvestigationCancelResponse(
                investigation_id=inv.id,
                status=InvestigationStatus.CANCELLED,
                message="Investigation is already cancelled.",
                cancelled_at=inv.cancelled_at or now,
            )

        # Mark investigation cancelled
        inv.status = InvestigationStatus.CANCELLED.value
        inv.substatus = "cancelled_by_user"
        inv.is_partial = True
        inv.cancellation_reason = payload.reason
        inv.cancelled_at = now
        inv.completed_at = now
        inv.updated_at = now

        # Cancel all pending tasks so workers do not pick them up
        tasks_stmt = (
            select(InvestigationTaskModel)
            .where(
                InvestigationTaskModel.investigation_id == inv.id,
                InvestigationTaskModel.status == "pending",
            )
            .with_for_update()
        )
        pending_tasks = (await self.db.execute(tasks_stmt)).scalars().all()
        for t in pending_tasks:
            t.status = "cancelled"
            t.updated_at = now

        # Emit cancellation event
        seq_stmt = select(
            func.coalesce(func.max(OperationalEventModel.sequence_number), 0) + 1
        ).where(OperationalEventModel.investigation_id == inv.id)
        next_seq = (await self.db.execute(seq_stmt)).scalar() or 1

        cancel_evt = OperationalEventModel(
            id=f"evt_{uuid4().hex[:16]}",
            workspace_id=actor.workspace_id,
            investigation_id=inv.id,
            sequence_number=next_seq,
            event_type=EventType.INVESTIGATION_CANCELLED.value,
            payload=InvestigationCancelledPayload(
                cancelled_at=now,
                reason=payload.reason,
            ).model_dump(mode="json"),
            created_at=now,
        )
        self.db.add(cancel_evt)

        # Audit event
        audit = AuditEventModel(
            id=f"aud_{uuid4().hex[:16]}",
            workspace_id=actor.workspace_id,
            actor_id=actor.user_id,
            action="cancel_investigation",
            target_type="investigation",
            target_id=inv.id,
            correlation_id=correlation_id,
            outcome="success",
            details={"reason": payload.reason},
            created_at=now,
        )
        self.db.add(audit)
        await self.db.commit()

        return InvestigationCancelResponse(
            investigation_id=inv.id,
            status=InvestigationStatus.CANCELLED,
            message="Investigation successfully cancelled.",
            cancelled_at=now,
        )

    async def get_event_stream(
        self,
        investigation_id: str,
        actor: AuthenticatedActor,
        last_event_id: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream Server-Sent Events with monotonic replay based on Last-Event-ID."""
        # 1. Tenant boundary check
        stmt = select(InvestigationModel).where(
            InvestigationModel.id == investigation_id,
            InvestigationModel.workspace_id == actor.workspace_id,
        )
        inv = (await self.db.execute(stmt)).scalar_one_or_none()
        if not inv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Investigation '{investigation_id}' not found.",
            )

        # 2. Parse last_event_id cursor
        start_seq = 0
        if last_event_id:
            try:
                # Can be plain integer or 'evt_<seq>'
                start_seq = int(last_event_id.replace("evt_", "").replace("seq_", ""))
            except ValueError:
                start_seq = 0

        current_seq = start_seq
        poll_interval_sec = 0.1
        idle_cycles = 0

        while True:
            # Fetch events newer than current_seq
            events_stmt = (
                select(OperationalEventModel)
                .where(
                    OperationalEventModel.investigation_id == investigation_id,
                    OperationalEventModel.workspace_id == actor.workspace_id,
                    OperationalEventModel.sequence_number > current_seq,
                )
                .order_by(OperationalEventModel.sequence_number.asc())
            )
            events = (await self.db.execute(events_stmt)).scalars().all()

            for event in events:
                current_seq = event.sequence_number
                data_str = json.dumps(event.payload)
                yield f"id: {event.sequence_number}\nevent: {event.event_type}\ndata: {data_str}\n\n"

            # Check fresh investigation status from database
            inv_status_stmt = select(InvestigationModel.status).where(
                InvestigationModel.id == investigation_id
            )
            current_status = (await self.db.execute(inv_status_stmt)).scalar_one_or_none()

            if (
                current_status
                in (
                    InvestigationStatus.COMPLETED.value,
                    InvestigationStatus.CANCELLED.value,
                    InvestigationStatus.FAILED.value,
                    InvestigationStatus.AWAITING_REVIEW.value,
                )
                and len(events) == 0
            ):
                # All events sent and investigation reached terminal state
                break

            # Heartbeat keep-alive comment
            idle_cycles += 1
            if idle_cycles % 10 == 0:
                yield ": keep-alive\n\n"

            await asyncio.sleep(poll_interval_sec)
