"""Investigation launch, status, cancellation, and budget models."""

from datetime import UTC, datetime

from pydantic import BaseModel, Field

from benchshield.domain.enums import InvestigationStatus


class InvestigationBudgets(BaseModel):
    """Resource budget tracking for an investigation."""

    max_queries: int = Field(
        ..., description="Maximum search queries permitted across all items", ge=0
    )
    used_queries: int = Field(default=0, description="Search queries executed to date", ge=0)
    max_fetches: int = Field(
        ..., description="Maximum page fetches permitted across all items", ge=0
    )
    used_fetches: int = Field(default=0, description="Page fetches executed to date", ge=0)
    cost_ceiling_usd: float = Field(..., description="Monetary spending limit in USD", ge=0.0)
    used_cost_usd: float = Field(
        default=0.0, description="Total provider spend incurred in USD", ge=0.0
    )
    deadline_seconds: int = Field(..., description="Investigation run timeout in seconds", ge=1)


class InvestigationLimitations(BaseModel):
    """Operational and coverage limitations encountered during discovery."""

    inaccessible_sources: list[str] = Field(
        default_factory=list, description="URLs that returned 403/404/timeout"
    )
    provider_outages: list[str] = Field(
        default_factory=list, description="Provider errors encountered"
    )
    scope_limitations: list[str] = Field(default_factory=list, description="Coverage caveat notes")


class InvestigationCreateRequest(BaseModel):
    """Payload to launch a new benchmark exposure investigation."""

    workspace_id: str = Field(..., description="Tenant workspace ID", min_length=1)
    benchmark_version_id: str = Field(
        ..., description="Immutable benchmark version to audit", min_length=1
    )
    policy_version_id: str = Field(
        ..., description="Immutable evaluation policy version to apply", min_length=1
    )


class Investigation(BaseModel):
    """Investigation lifecycle entity."""

    investigation_id: str = Field(..., description="Unique investigation identifier", min_length=1)
    workspace_id: str = Field(..., description="Tenant workspace ID", min_length=1)
    benchmark_version_id: str = Field(..., description="Target benchmark version ID", min_length=1)
    policy_version_id: str = Field(..., description="Active policy version ID", min_length=1)
    status: InvestigationStatus = Field(
        default=InvestigationStatus.QUEUED, description="Current lifecycle state"
    )
    is_partial: bool = Field(
        default=False, description="Flag indicating partial coverage rather than clean success"
    )
    total_items: int = Field(..., description="Total items in benchmark scope", ge=1)
    investigated_items: int = Field(
        default=0, description="Number of items investigated so far", ge=0
    )
    budgets: InvestigationBudgets = Field(..., description="Active budget allocations and spend")
    limitations: InvestigationLimitations = Field(
        default_factory=InvestigationLimitations, description="Encountered limitations"
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Launch request timestamp"
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Last state update timestamp"
    )
    completed_at: datetime | None = Field(default=None, description="Terminal state timestamp")
    cancellation_reason: str | None = Field(default=None, description="Reason if cancelled")


class InvestigationStatusResponse(BaseModel):
    """Public read model for investigation status."""

    investigation_id: str = Field(..., description="Investigation identifier")
    status: InvestigationStatus = Field(..., description="Current status")
    is_partial: bool = Field(..., description="Whether investigation is marked as partial coverage")
    total_items: int = Field(..., description="Total items in scope")
    investigated_items: int = Field(..., description="Items completed so far")
    budgets: InvestigationBudgets = Field(..., description="Budget snapshot")
    limitations: InvestigationLimitations = Field(..., description="Limitations encountered")
    findings_count: int = Field(default=0, description="Number of findings discovered so far", ge=0)
    created_at: datetime = Field(..., description="Investigation start time")
    updated_at: datetime = Field(..., description="Last updated time")


class InvestigationCancelRequest(BaseModel):
    """Payload to request idempotent investigation cancellation."""

    reason: str = Field(
        ..., description="Explanation for cancellation", min_length=1, max_length=1000
    )


class InvestigationCancelResponse(BaseModel):
    """Response confirming investigation cancellation request."""

    investigation_id: str = Field(..., description="Investigation identifier")
    status: InvestigationStatus = Field(..., description="Updated investigation status")
    message: str = Field(..., description="Cancellation confirmation message")
    cancelled_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Cancellation timestamp"
    )
