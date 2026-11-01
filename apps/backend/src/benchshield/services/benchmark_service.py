"""Operational Benchmark Service handling validated import, atomic persistence, and retrieval."""

import hashlib
import json
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from benchshield.api.auth import AuthenticatedActor
from benchshield.config import Settings, get_settings
from benchshield.domain.enums import TaskType
from benchshield.domain.models.benchmarks import (
    BenchmarkRecord,
    BenchmarkVersion,
    ChoiceOption,
    ItemVersion,
    ItemVersionListResponse,
    PublicItemMetadata,
)
from benchshield.domain.models.intake import (
    BenchmarkImportRequest,
    BenchmarkImportResponse,
)
from benchshield.persistence.models import (
    AuditEventModel,
    BenchmarkModel,
    BenchmarkVersionModel,
    ImportIdempotencyModel,
    ItemVersionModel,
    ProtectedAnswerModel,
)
from benchshield.services.intake_service import BenchmarkIntakeService
from benchshield.storage.vault_encryption import encrypt_gold_answer


class BenchmarkService:
    """Core domain service for benchmark imports and metadata retrieval."""

    def __init__(self, db: AsyncSession, settings: Settings | None = None):
        self.db = db
        self.settings = settings or get_settings()

    async def import_benchmark(
        self,
        request: BenchmarkImportRequest,
        actor: AuthenticatedActor,
        correlation_id: str,
        idempotency_key: str | None = None,
    ) -> BenchmarkImportResponse:
        """Validate whole benchmark import and atomically commit public items and vaulted answers."""
        return await self.import_benchmark_items(
            name=request.name,
            raw_items=[item.model_dump() for item in request.items],
            actor=actor,
            correlation_id=correlation_id,
            idempotency_key=idempotency_key,
        )

    async def import_benchmark_items(
        self,
        name: str,
        raw_items: list[dict[str, Any]],
        actor: AuthenticatedActor,
        correlation_id: str,
        idempotency_key: str | None = None,
    ) -> BenchmarkImportResponse:
        """Validate raw benchmark items (from CSV or JSON) and atomically commit public items and vaulted answers."""
        # 1. Idempotency Check
        request_raw_repr = json.dumps(
            {
                "workspace_id": actor.workspace_id,
                "name": name,
                "items": raw_items,
            },
            sort_keys=True,
        )
        request_hash = hashlib.sha256(request_raw_repr.encode("utf-8")).hexdigest()

        if idempotency_key:
            stmt = select(ImportIdempotencyModel).where(
                ImportIdempotencyModel.workspace_id == actor.workspace_id,
                ImportIdempotencyModel.idempotency_key == idempotency_key,
                ImportIdempotencyModel.operation == "import_benchmark",
            )
            existing_record = (await self.db.execute(stmt)).scalar_one_or_none()

            if existing_record is not None:
                if existing_record.request_hash == request_hash:
                    # Idempotent replay: return cached response
                    return BenchmarkImportResponse.model_validate(existing_record.response_body)
                else:
                    # Idempotency conflict: key reused with differing payload
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Idempotency key reused with different request payload.",
                    )

        # 2. Validation across whole batch (pure intake parser)
        intake_resp, public_items, gold_records = BenchmarkIntakeService.validate_and_process(
            raw_items,
            benchmark_name=name,
            workspace_id=actor.workspace_id,
        )

        # Atomic Rejection: if invalid, return row errors without modifying database
        if intake_resp.status == "rejected":
            return intake_resp

        # 3. Atomic Database Persistence
        try:
            # A. Get or create parent Benchmark entity
            bmk_stmt = select(BenchmarkModel).where(
                BenchmarkModel.workspace_id == actor.workspace_id,
                BenchmarkModel.name == name,
            )
            benchmark = (await self.db.execute(bmk_stmt)).scalar_one_or_none()

            if benchmark is None:
                benchmark_id = f"bmk_{uuid4().hex[:16]}"
                benchmark = BenchmarkModel(
                    id=benchmark_id,
                    workspace_id=actor.workspace_id,
                    name=name,
                    description=None,
                )
                self.db.add(benchmark)
                await self.db.flush()
                version_number = 1
            else:
                benchmark_id = benchmark.id
                # Determine next version number
                v_stmt = select(func.max(BenchmarkVersionModel.version_number)).where(
                    BenchmarkVersionModel.workspace_id == actor.workspace_id,
                    BenchmarkVersionModel.benchmark_id == benchmark_id,
                )
                curr_max = (await self.db.execute(v_stmt)).scalar_one_or_none()
                version_number = (curr_max or 0) + 1

            # B. Insert BenchmarkVersionModel
            benchmark_version_id = intake_resp.benchmark_version_id or f"bmv_{uuid4().hex[:16]}"
            distinct_tasks = sorted(list({it.task_type.value for it in public_items}))

            bm_version_row = BenchmarkVersionModel(
                id=benchmark_version_id,
                benchmark_id=benchmark_id,
                workspace_id=actor.workspace_id,
                version_number=version_number,
                item_count=len(public_items),
                task_types=distinct_tasks,
            )
            self.db.add(bm_version_row)

            # C. Insert ItemVersionModel (public representation only)
            for item in public_items:
                item_row = ItemVersionModel(
                    id=item.item_version_id,
                    benchmark_version_id=benchmark_version_id,
                    workspace_id=actor.workspace_id,
                    external_id=item.external_id,
                    task_type=item.task_type.value,
                    question=item.question,
                    choices=[c.model_dump() for c in item.choices] if item.choices else None,
                    answer_revision_id=item.answer_revision_id,
                    metadata_=item.metadata.model_dump(),
                )
                self.db.add(item_row)

            # D. Insert ProtectedAnswerModel in vault schema with AES-256-GCM encryption
            for gold in gold_records:
                ciphertext, nonce, key_ver = encrypt_gold_answer(
                    plaintext=gold.gold_answer_text,
                    key_hex=self.settings.vault_encryption_key,
                    key_version=self.settings.vault_key_version,
                )
                vault_row = ProtectedAnswerModel(
                    id=gold.answer_revision_id,
                    workspace_id=actor.workspace_id,
                    benchmark_version_id=benchmark_version_id,
                    item_version_id=gold.item_version_id,
                    external_id=gold.external_id,
                    encrypted_answer=ciphertext,
                    nonce=nonce,
                    key_version=key_ver,
                    gold_choice_id=gold.gold_choice_id,
                    content_hash=gold.content_hash,
                )
                self.db.add(vault_row)

            # E. Record Audit Event
            audit_event = AuditEventModel(
                id=f"aud_{uuid4().hex[:16]}",
                workspace_id=actor.workspace_id,
                actor_id=actor.user_id,
                action="benchmark.import",
                target_type="benchmark_version",
                target_id=benchmark_version_id,
                correlation_id=correlation_id,
                outcome="success",
                details={
                    "benchmark_id": benchmark_id,
                    "benchmark_name": name,
                    "item_count": len(public_items),
                    "version_number": version_number,
                },
            )
            self.db.add(audit_event)

            # F. Record Idempotency
            final_response = BenchmarkImportResponse(
                benchmark_id=benchmark_id,
                benchmark_version_id=benchmark_version_id,
                total_rows=len(public_items),
                valid_rows=len(public_items),
                status="accepted",
                errors=[],
            )

            if idempotency_key:
                idemp_record = ImportIdempotencyModel(
                    id=f"idemp_{uuid4().hex[:16]}",
                    workspace_id=actor.workspace_id,
                    idempotency_key=idempotency_key,
                    operation="import_benchmark",
                    request_hash=request_hash,
                    response_status=200,
                    response_body=final_response.model_dump(mode="json"),
                )
                self.db.add(idemp_record)

            await self.db.commit()
            return final_response

        except IntegrityError as err:
            await self.db.rollback()
            if idempotency_key:
                stmt = select(ImportIdempotencyModel).where(
                    ImportIdempotencyModel.workspace_id == actor.workspace_id,
                    ImportIdempotencyModel.idempotency_key == idempotency_key,
                    ImportIdempotencyModel.operation == "import_benchmark",
                )
                existing_record = (await self.db.execute(stmt)).scalar_one_or_none()
                if existing_record is not None:
                    if existing_record.request_hash == request_hash:
                        return BenchmarkImportResponse.model_validate(existing_record.response_body)
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Idempotency key reused with different request payload.",
                    ) from err
            raise err
        except Exception as err:
            await self.db.rollback()
            raise err

    async def get_benchmark(
        self,
        benchmark_id: str,
        actor: AuthenticatedActor,
    ) -> BenchmarkRecord:
        """Retrieve benchmark parent metadata for authorized workspace."""
        stmt = select(BenchmarkModel).where(
            BenchmarkModel.workspace_id == actor.workspace_id,
            BenchmarkModel.id == benchmark_id,
        )
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Benchmark '{benchmark_id}' not found in workspace '{actor.workspace_id}'.",
            )

        # Count versions and find latest version
        v_stmt = (
            select(BenchmarkVersionModel)
            .where(
                BenchmarkVersionModel.workspace_id == actor.workspace_id,
                BenchmarkVersionModel.benchmark_id == benchmark_id,
            )
            .order_by(BenchmarkVersionModel.version_number.desc())
        )
        versions = (await self.db.execute(v_stmt)).scalars().all()
        latest_version = versions[0].id if versions else None

        return BenchmarkRecord(
            benchmark_id=row.id,
            workspace_id=row.workspace_id,
            name=row.name,
            description=row.description,
            latest_version_id=latest_version,
            version_count=len(versions),
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    async def get_benchmark_version(
        self,
        version_id: str,
        actor: AuthenticatedActor,
    ) -> BenchmarkVersion:
        """Retrieve authorized immutable benchmark version metadata."""
        stmt = select(BenchmarkVersionModel).where(
            BenchmarkVersionModel.workspace_id == actor.workspace_id,
            BenchmarkVersionModel.id == version_id,
        )
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Benchmark version '{version_id}' not found in workspace '{actor.workspace_id}'.",
            )

        # Fetch parent benchmark name
        bmk_stmt = select(BenchmarkModel.name).where(BenchmarkModel.id == row.benchmark_id)
        name = (await self.db.execute(bmk_stmt)).scalar_one_or_none() or "Benchmark"

        return BenchmarkVersion(
            benchmark_version_id=row.id,
            benchmark_id=row.benchmark_id,
            workspace_id=row.workspace_id,
            name=name,
            version_number=row.version_number,
            item_count=row.item_count,
            task_types=[TaskType(t) for t in row.task_types],
            created_at=row.created_at,
        )

    async def list_items(
        self,
        version_id: str,
        actor: AuthenticatedActor,
        page: int = 1,
        page_size: int = 50,
    ) -> ItemVersionListResponse:
        """Paginated item listing strictly excluding protected answers."""
        # 1. Verify benchmark version belongs to workspace
        await self.get_benchmark_version(version_id, actor)

        # 2. Count total items
        count_stmt = select(func.count(ItemVersionModel.id)).where(
            ItemVersionModel.workspace_id == actor.workspace_id,
            ItemVersionModel.benchmark_version_id == version_id,
        )
        total_count = (await self.db.execute(count_stmt)).scalar_one()

        # 3. Query paginated public items
        offset = (page - 1) * page_size
        stmt = (
            select(ItemVersionModel)
            .where(
                ItemVersionModel.workspace_id == actor.workspace_id,
                ItemVersionModel.benchmark_version_id == version_id,
            )
            .order_by(ItemVersionModel.external_id)
            .offset(offset)
            .limit(page_size)
        )
        rows = (await self.db.execute(stmt)).scalars().all()

        items = [
            ItemVersion(
                item_version_id=r.id,
                benchmark_version_id=r.benchmark_version_id,
                external_id=r.external_id,
                task_type=TaskType(r.task_type),
                question=r.question,
                choices=[ChoiceOption.model_validate(c) for c in r.choices] if r.choices else None,
                answer_revision_id=r.answer_revision_id,
                metadata=PublicItemMetadata.model_validate(r.metadata_),
            )
            for r in rows
        ]

        has_more = (offset + len(items)) < total_count

        return ItemVersionListResponse(
            items=items,
            total_count=total_count,
            page=page,
            page_size=page_size,
            has_more=has_more,
        )
