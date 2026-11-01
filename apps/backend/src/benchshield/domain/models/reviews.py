"""Human reviewer decision and optimistic concurrency models."""

from datetime import UTC, datetime

from pydantic import BaseModel, Field

from benchshield.domain.enums import ReviewAction


class ReviewCreateRequest(BaseModel):
    """Payload to record a human reviewer adjudication decision.

    Includes expected_version for optimistic concurrency conflict detection.
    """

    expected_version: int = Field(..., description="Expected current finding version", ge=1)
    action: ReviewAction = Field(
        ..., description="Adjudication decision: confirm, reject, or request_more_evidence"
    )
    reason: str = Field(
        ...,
        description="Explanation for decision (required for auditability)",
        min_length=1,
        max_length=2000,
    )


class ReviewDecision(BaseModel):
    """Immutable audit record of a reviewer decision."""

    decision_id: str = Field(..., description="Unique decision ID", min_length=1)
    finding_id: str = Field(..., description="Target finding ID", min_length=1)
    expected_version: int = Field(..., description="Finding version before this decision", ge=1)
    new_version: int = Field(..., description="Finding version after this decision", ge=2)
    reviewer_id: str = Field(..., description="Identity of the human reviewer", min_length=1)
    action: ReviewAction = Field(..., description="Adjudication decision")
    reason: str = Field(..., description="Auditable rationale for the decision")
    reviewed_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Timestamp of review"
    )


class ReviewHistoryResponse(BaseModel):
    """Append-only audit trail of human reviewer decisions for a finding."""

    finding_id: str = Field(..., description="Finding identifier")
    decisions: list[ReviewDecision] = Field(
        default_factory=list, description="Historical decisions in chronological order"
    )
