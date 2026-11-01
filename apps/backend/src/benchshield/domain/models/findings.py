"""Findings, independent exposure claims, verification, and temporal models."""

from datetime import UTC, datetime

from pydantic import BaseModel, Field

from benchshield.domain.enums import (
    AnswerMatch,
    ClaimStatus,
    ExposureType,
    TaskIdentity,
    TemporalStatus,
)
from benchshield.domain.models.evidence import SourceSnapshot


class EvidenceClaim(BaseModel):
    """Specific exposure claim asserted for an item."""

    claim_id: str = Field(..., description="Unique claim ID", min_length=1)
    exposure_type: ExposureType = Field(..., description="Type of exposed benchmark component")
    claim_status: ClaimStatus = Field(
        default=ClaimStatus.CANDIDATE, description="Status of the claim"
    )
    rationale: str = Field(
        ..., description="Evidence rationale explaining why this claim was generated"
    )


class VerificationResult(BaseModel):
    """Assessment of task identity and answer agreement.

    Task identity must be established before answer agreement.
    """

    verification_id: str = Field(..., description="Verification record ID", min_length=1)
    task_identity: TaskIdentity = Field(..., description="Correspondence of task/question identity")
    answer_match: AnswerMatch = Field(..., description="Correspondence of answer agreement")
    normalization_version: str = Field(
        default="norm_v1.0", description="Version of normalization algorithm"
    )
    grader_version: str = Field(
        default="grader_v1.0", description="Version of trusted verification grader"
    )
    explanation: str = Field(..., description="Granular explanation of verification determination")


class TemporalAssessment(BaseModel):
    """Independent temporal classification and supporting timestamps.

    A post-cutoff observation does not prove pre-cutoff absence, and missing dates stay unknown.
    """

    assessment_id: str = Field(..., description="Assessment record ID", min_length=1)
    temporal_status: TemporalStatus = Field(
        default=TemporalStatus.UNKNOWN, description="Temporal relationship to benchmark cutoff"
    )
    retrieval_time: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="Timestamp when the source was fetched",
    )
    asserted_publication_time: datetime | None = Field(
        default=None, description="Unverified publication timestamp displayed by page"
    )
    commit_time: datetime | None = Field(
        default=None, description="Git commit timestamp if source is a repository"
    )
    archive_capture_time: datetime | None = Field(
        default=None, description="Wayback Machine / Web Archive snapshot timestamp"
    )
    verified_introduction_time: datetime | None = Field(
        default=None, description="Proven earliest public introduction time"
    )
    supporting_evidence_note: str | None = Field(
        default=None, description="Provenance of temporal verification"
    )


class FindingView(BaseModel):
    """Public read model for an audited finding with independent dimensions."""

    finding_id: str = Field(..., description="Finding identifier", min_length=1)
    investigation_id: str = Field(..., description="Parent investigation ID", min_length=1)
    item_version_id: str = Field(..., description="Item version ID", min_length=1)
    external_id: str = Field(..., description="External item identifier", min_length=1)
    version: int = Field(
        default=1, description="Optimistic concurrency version for reviewer updates", ge=1
    )
    claim: EvidenceClaim = Field(..., description="Exposure claim")
    verification: VerificationResult = Field(..., description="Task identity and answer agreement")
    temporal: TemporalAssessment = Field(..., description="Temporal assessment")
    snapshot: SourceSnapshot = Field(..., description="Supporting source evidence snapshot")
    current_reviewer_decision: str | None = Field(
        default=None, description="Latest human decision: confirm, reject, or request_more_evidence"
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Finding creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Last update timestamp"
    )


class FindingListResponse(BaseModel):
    """Paginated list of findings."""

    items: list[FindingView] = Field(default_factory=list, description="Findings on current page")
    total: int = Field(..., description="Total findings matching query", ge=0)
    page: int = Field(default=1, description="1-indexed current page", ge=1)
    size: int = Field(default=20, description="Items per page", ge=1, le=100)


class VerificationRunResponse(BaseModel):
    """Result of running the trusted grader over an investigation's candidates."""

    investigation_id: str = Field(..., description="Investigation ID")
    findings_created: int = Field(..., description="New findings created in this run", ge=0)
    grader_version: str = Field(..., description="Grader version applied")
    normalization_version: str = Field(..., description="Normalization version applied")
    claim_status_counts: dict[str, int] = Field(
        default_factory=dict, description="Total findings per claim status after this run"
    )
