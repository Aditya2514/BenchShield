"""Benchmark and Item version models."""

from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, Field

from benchshield.domain.enums import TaskType


class ChoiceOption(BaseModel):
    """Multiple choice option key and text."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(
        ..., description="Option identifier (e.g., 'A', 'B', '1')", min_length=1, max_length=16
    )
    text: str = Field(
        ..., description="Text content of the choice option", min_length=1, max_length=4096
    )


class PublicItemMetadata(BaseModel):
    """Allowlisted, strictly typed public item metadata.

    CRITICAL BOUNDARY: Extra/arbitrary fields are strictly forbidden to prevent
    accidental leaking of protected answers, vault keys, or internal annotations.
    """

    model_config = ConfigDict(extra="forbid")

    domain: str | None = Field(
        default=None,
        max_length=128,
        description="Subject domain of the item (e.g. 'chemistry', 'navigation')",
    )
    difficulty: str | None = Field(
        default=None, max_length=64, description="Nominal difficulty rating"
    )
    tags: list[str] = Field(
        default_factory=list, max_length=32, description="Allowlisted categorization tags"
    )
    source_reference: str | None = Field(
        default=None, max_length=256, description="Non-confidential source origin citation"
    )
    license: str | None = Field(
        default=None, max_length=128, description="Content license identifier"
    )


class ItemVersion(BaseModel):
    """Immutable benchmark item representation for public/releasable operations.

    Protected gold answers and grading rubrics are strictly excluded.
    Binds to an exact immutable gold reference via gold_binding_version.
    """

    model_config = ConfigDict(extra="forbid")

    item_version_id: str = Field(..., description="Unique immutable item version ID", min_length=1)
    benchmark_version_id: str = Field(..., description="Parent benchmark version ID", min_length=1)
    external_id: str = Field(
        ..., description="User-supplied external item ID", min_length=1, max_length=256
    )
    task_type: TaskType = Field(..., description="Task type of the benchmark item")
    question: str = Field(..., description="Question prompt text", min_length=1, max_length=32768)
    choices: list[ChoiceOption] | None = Field(
        default=None, description="Ordered options for multiple-choice tasks"
    )
    answer_revision_id: str = Field(
        ...,
        description="Opaque random answer revision identifier allocated by persistence layer",
        min_length=1,
    )
    metadata: PublicItemMetadata = Field(
        default_factory=PublicItemMetadata,
        description="Allowlisted, typed public metadata",
    )


class BenchmarkVersion(BaseModel):
    """Immutable benchmark version representation."""

    model_config = ConfigDict(extra="forbid")

    benchmark_version_id: str = Field(
        ..., description="Unique immutable benchmark version ID", min_length=1
    )
    benchmark_id: str = Field(default="", description="Parent benchmark entity ID")
    workspace_id: str = Field(..., description="Tenant workspace ID", min_length=1)
    name: str = Field(..., description="Benchmark name", min_length=1, max_length=256)
    version_number: int = Field(default=1, description="Monotonic version sequence number", ge=1)
    item_count: int = Field(..., description="Total number of items in this version", ge=0)
    task_types: list[TaskType] = Field(default_factory=list, description="Task types in version")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Timestamp of version creation"
    )


class BenchmarkRecord(BaseModel):
    """Parent benchmark entity containing metadata and latest version."""

    model_config = ConfigDict(extra="forbid")

    benchmark_id: str = Field(..., description="Benchmark entity ID", min_length=1)
    workspace_id: str = Field(..., description="Tenant workspace ID", min_length=1)
    name: str = Field(..., description="Benchmark name", min_length=1, max_length=256)
    description: str | None = Field(default=None, description="Optional description")
    latest_version_id: str | None = Field(default=None, description="Latest benchmark version ID")
    version_count: int = Field(default=1, description="Number of versions created", ge=1)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Update timestamp"
    )


class ItemVersionListResponse(BaseModel):
    """Paginated list of item versions for an authorized benchmark version."""

    model_config = ConfigDict(extra="forbid")

    items: list[ItemVersion] = Field(..., description="Page of public item versions")
    total_count: int = Field(..., description="Total item count in version", ge=0)
    page: int = Field(default=1, description="1-indexed current page", ge=1)
    page_size: int = Field(default=50, description="Items per page", ge=1, le=500)
    has_more: bool = Field(..., description="Whether subsequent pages exist")
