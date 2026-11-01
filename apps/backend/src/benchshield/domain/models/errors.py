"""Standard error response models for the BenchShield API."""

from datetime import UTC, datetime

from pydantic import BaseModel, Field

from benchshield.domain.enums import ErrorCode


class ErrorDetail(BaseModel):
    """Specific detail regarding an error location and reason."""

    field: str | None = Field(default=None, description="Field name or parameter causing the error")
    code: str = Field(..., description="Machine-readable sub-error code")
    message: str = Field(
        ..., description="Human-readable explanation (never echoing sensitive values)"
    )


class ErrorResponse(BaseModel):
    """Standardized API error response body."""

    error: ErrorCode = Field(..., description="Machine-readable top-level error code")
    message: str = Field(..., description="Top-level error message")
    details: list[ErrorDetail] = Field(
        default_factory=list, description="List of granular error details"
    )
    request_id: str = Field(default="req_default", description="Correlation ID for tracing")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Timestamp when the error occurred"
    )
