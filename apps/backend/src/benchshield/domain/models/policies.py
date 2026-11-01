"""Evaluation Policy and privacy boundary models."""

from datetime import UTC, datetime

from pydantic import BaseModel, Field

from benchshield.domain.enums import DataClassification, RetentionProfile, SourceFamily


class EvaluationPolicyCreateRequest(BaseModel):
    """Payload to create an immutable evaluation policy version."""

    workspace_id: str | None = Field(
        default=None,
        description="Optional tenant workspace ID; authenticated actor workspace takes precedence",
    )
    name: str = Field(..., description="Descriptive policy name", min_length=1, max_length=256)
    allowed_tools: list[str] = Field(
        default=["search", "fetch"],
        description="Tools permitted during discovery (e.g. 'search', 'fetch')",
    )
    allowed_source_classes: list[SourceFamily] = Field(
        default=[
            SourceFamily.WEB_SEARCH,
            SourceFamily.CODE_REPOSITORY,
            SourceFamily.ACADEMIC_ARCHIVE,
            SourceFamily.DISCUSSION_FORUM,
        ],
        description="Permitted source families",
    )
    prohibited_answer_key_access: bool = Field(
        default=True, description="Whether accessing published answer keys is strictly prohibited"
    )
    benchmark_identification_permitted: bool = Field(
        default=False,
        description="Whether investigation prompts may mention the benchmark identity",
    )
    evaluation_cutoff: datetime = Field(
        ..., description="Evaluation cutoff date and time (ISO-8601)"
    )
    cutoff_timezone: str = Field(
        default="UTC",
        description="Timezone of the evaluation cutoff (e.g. 'UTC', 'America/New_York')",
    )
    item_scope: list[str] | None = Field(
        default=None,
        description="Specific item IDs in scope, or None for all items in the benchmark",
    )
    max_queries_per_item: int = Field(
        default=3, ge=1, le=20, description="Max search queries per item"
    )
    max_fetches_per_item: int = Field(
        default=5, ge=1, le=50, description="Max fetched pages per item"
    )
    max_concurrent_discovery_tasks: int = Field(
        default=2, ge=1, le=10, description="Max concurrent discovery tasks"
    )
    deadline_seconds: int = Field(
        default=900, ge=60, le=86400, description="Investigation execution deadline"
    )
    cost_ceiling_usd: float = Field(default=10.0, ge=0.0, description="Monetary ceiling in USD")
    data_classification: DataClassification = Field(
        default=DataClassification.PUBLIC,
        description="Classification of uploaded benchmarks (confidential discovery is policy blocked)",
    )
    retention_profile: RetentionProfile = Field(
        default=RetentionProfile.PILOT_STANDARD_30_90,
        description="Retention profile for evidence and reports",
    )
    reviewer_identity: str = Field(
        ..., description="Identity of the auditor/reviewer creating this policy", min_length=1
    )


class EvaluationPolicyVersion(BaseModel):
    """Immutable evaluation policy version record."""

    policy_version_id: str = Field(..., description="Unique policy version ID", min_length=1)
    policy_id: str = Field(default="", description="Parent policy entity ID")
    workspace_id: str | None = Field(
        default=None,
        description="Optional tenant workspace ID; authenticated actor workspace takes precedence",
    )
    name: str = Field(..., description="Policy name", min_length=1, max_length=256)
    version_number: int = Field(default=1, description="Version sequence number", ge=1)
    allowed_tools: list[str] = Field(..., description="Permitted tools")
    allowed_source_classes: list[SourceFamily] = Field(..., description="Permitted source families")
    prohibited_answer_key_access: bool = Field(..., description="Prohibit answer key access")
    benchmark_identification_permitted: bool = Field(
        ..., description="Permit benchmark identity in search"
    )
    evaluation_cutoff: datetime = Field(..., description="Evaluation cutoff timestamp")
    cutoff_timezone: str = Field(default="UTC", description="Evaluation cutoff timezone")
    item_scope: list[str] | None = Field(default=None, description="Item scope IDs or None")
    max_queries_per_item: int = Field(..., description="Max queries per item")
    max_fetches_per_item: int = Field(..., description="Max fetches per item")
    max_concurrent_discovery_tasks: int = Field(..., description="Max concurrency")
    deadline_seconds: int = Field(..., description="Run deadline in seconds")
    cost_ceiling_usd: float = Field(..., description="Monetary limit in USD")
    data_classification: DataClassification = Field(..., description="Data classification level")
    retention_profile: RetentionProfile = Field(..., description="Retention schedule profile")
    reviewer_identity: str = Field(..., description="Author identity")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Timestamp of policy creation"
    )


class EvaluationPolicyRecord(BaseModel):
    """Parent policy entity containing metadata and latest version."""

    policy_id: str = Field(..., description="Policy entity ID", min_length=1)
    workspace_id: str | None = Field(
        default=None,
        description="Optional tenant workspace ID; authenticated actor workspace takes precedence",
    )
    name: str = Field(..., description="Policy name", min_length=1, max_length=256)
    latest_version_id: str | None = Field(default=None, description="Latest policy version ID")
    version_count: int = Field(default=1, description="Version count", ge=1)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Update timestamp"
    )
