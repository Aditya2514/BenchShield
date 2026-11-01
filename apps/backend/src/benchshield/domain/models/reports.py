"""Versioned immutable audit report models."""

from datetime import UTC, datetime

from pydantic import BaseModel, Field

from benchshield.domain.enums import ReportStatus


class ReportSummaryCounts(BaseModel):
    """Aggregate finding statistics in a frozen report version."""

    total_items: int = Field(..., description="Total items audited", ge=0)
    verified_claims_count: int = Field(
        default=0, description="Verified exposure claims count", ge=0
    )
    rejected_claims_count: int = Field(default=0, description="Rejected claims count", ge=0)
    needs_review_count: int = Field(default=0, description="Claims pending human review", ge=0)
    timing_unknown_count: int = Field(
        default=0, description="Verified findings with unknown timing", ge=0
    )
    verified_pre_cutoff_count: int = Field(
        default=0, description="Verified findings pre-cutoff", ge=0
    )


class ReportCreateRequest(BaseModel):
    """Payload to trigger asynchronous frozen report generation."""

    investigation_id: str = Field(
        ..., description="Target completed investigation ID", min_length=1
    )


class ReportVersion(BaseModel):
    """Immutable audit report representation."""

    report_id: str = Field(..., description="Unique report job identifier", min_length=1)
    report_version: str = Field(
        ..., description="Semantic report version label (e.g. 'R-001')", min_length=1
    )
    investigation_id: str = Field(..., description="Source investigation ID", min_length=1)
    benchmark_version_id: str = Field(..., description="Frozen benchmark version ID", min_length=1)
    policy_version_id: str = Field(..., description="Frozen policy version ID", min_length=1)
    status: ReportStatus = Field(default=ReportStatus.QUEUED, description="Export job status")
    frozen_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="Timestamp when snapshot inputs were frozen",
    )
    methodology_version: str = Field(
        default="audit_v1.0", description="Methodology version applied"
    )
    summary_counts: ReportSummaryCounts = Field(..., description="Aggregate finding metrics")
    limitations: list[str] = Field(default_factory=list, description="Coverage and timing caveats")
    download_url: str | None = Field(
        default=None, description="Time-limited authorized download URL"
    )
    authorized_until: datetime | None = Field(default=None, description="Download expiry timestamp")


class ReportStatusResponse(BaseModel):
    """Status check response for an asynchronous report export job."""

    report_id: str = Field(..., description="Report job identifier")
    report_version: str = Field(..., description="Report version label")
    status: ReportStatus = Field(..., description="Current export status")
    download_url: str | None = Field(default=None, description="Signed download URL if completed")
    authorized_until: datetime | None = Field(
        default=None, description="Download expiration timestamp if completed"
    )
