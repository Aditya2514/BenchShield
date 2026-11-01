"""Protected intake and benchmark import models.

These models handle the ingestion and isolation of benchmark data, specifically isolating
gold answers from public response schemas.
"""

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from benchshield.domain.enums import TaskType
from benchshield.domain.models.benchmarks import ChoiceOption, PublicItemMetadata


class ItemIntake(BaseModel):
    """Raw item ingestion schema containing protected answers.

    This model is restricted to the trusted intake and gold-vault storage boundary.
    It MUST NEVER be returned directly in public API response endpoints.
    Extra fields are forbidden to prevent untyped data injection.
    """

    model_config = ConfigDict(extra="forbid")

    external_id: str = Field(
        ..., description="External item identifier", min_length=1, max_length=256
    )
    task_type: TaskType = Field(..., description="Supported benchmark task type")
    question: str = Field(..., description="Question prompt text", min_length=1, max_length=32768)
    choices: list[ChoiceOption] | None = Field(
        default=None, description="Ordered options for multiple-choice tasks"
    )
    gold_answer: str = Field(
        ...,
        description="Protected reference answer text or choice ID",
        min_length=1,
        max_length=16384,
    )
    metadata: PublicItemMetadata = Field(
        default_factory=PublicItemMetadata,
        description="Allowlisted public metadata only; arbitrary or protected metadata is forbidden",
    )


class GoldVaultRecord(BaseModel):
    """Protected reference answer record stored within the isolated gold vault.

    Only accessible by trusted verifier credentials with dedicated runtime identity.
    """

    model_config = ConfigDict(extra="forbid")

    vault_item_id: str = Field(..., description="Internal vault record identifier")
    benchmark_version_id: str = Field(..., description="Parent benchmark version ID")
    item_version_id: str = Field(..., description="Parent item version ID")
    external_id: str = Field(..., description="Benchmark item external ID")
    answer_binding_version: str = Field(
        ..., description="Salted version binding to protected answer"
    )
    gold_answer_text: str = Field(..., description="Normalized reference answer text")
    gold_choice_id: str | None = Field(
        default=None, description="Choice ID if multiple-choice task"
    )
    content_hash: str = Field(..., description="Internal hash of protected answer")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="Timestamp when protected answer was vaulted",
    )


class ImportRowError(BaseModel):
    """Detailed validation error for a single row in an import batch.

    CRITICAL: Error messages and details MUST NEVER echo or format the protected gold answer.
    """

    model_config = ConfigDict(extra="forbid")

    row_number: int = Field(..., description="1-indexed row number where the error occurred", ge=1)
    field: str = Field(
        ..., description="Field name containing the error (e.g. 'gold_answer', 'choices')"
    )
    error_code: str = Field(..., description="Machine-readable error identifier")
    message: str = Field(
        ..., description="Human-readable description without sensitive answer data"
    )


class BenchmarkImportRequest(BaseModel):
    """Benchmark creation payload containing items and metadata."""

    model_config = ConfigDict(extra="forbid")

    workspace_id: str = Field(..., description="Tenant workspace ID", min_length=1)
    name: str = Field(
        ..., description="User-friendly name of the benchmark", min_length=1, max_length=256
    )
    items: list[ItemIntake] = Field(
        ...,
        description="List of benchmark items to validate and import",
        min_length=1,
        max_length=10000,
    )


class BenchmarkImportResponse(BaseModel):
    """Result of benchmark intake validation.

    If validation fails for ANY row, status is 'rejected', benchmark_version_id is None,
    and row-level errors are provided. The import is strictly atomic.
    """

    model_config = ConfigDict(extra="forbid")

    benchmark_version_id: str | None = Field(
        default=None, description="Created benchmark version ID if accepted, None if rejected"
    )
    total_rows: int = Field(..., description="Total rows submitted in the import batch", ge=0)
    valid_rows: int = Field(..., description="Number of valid rows identified", ge=0)
    status: Literal["accepted", "rejected"] = Field(..., description="Atomic import outcome")
    errors: list[ImportRowError] = Field(
        default_factory=list, description="List of validation errors if rejected"
    )
