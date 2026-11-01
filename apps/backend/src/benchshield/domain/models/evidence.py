"""Source snapshot and evidence reference models."""

from datetime import UTC, datetime

from pydantic import BaseModel, Field

from benchshield.domain.enums import SnapshotAvailability, SourceFamily


class ExcerptLocator(BaseModel):
    """Precise location of discovered evidence within a raw snapshot."""

    line_start: int | None = Field(
        default=None, description="Starting line number (1-indexed)", ge=1
    )
    line_end: int | None = Field(default=None, description="Ending line number (1-indexed)", ge=1)
    char_offset_start: int | None = Field(default=None, description="Character offset start", ge=0)
    char_offset_end: int | None = Field(default=None, description="Character offset end", ge=0)
    selector: str | None = Field(
        default=None, description="CSS selector or DOM locator if structured document"
    )


class SourceSnapshot(BaseModel):
    """Immutable evidence snapshot reference."""

    snapshot_id: str = Field(..., description="Unique evidence snapshot ID", min_length=1)
    source_url: str = Field(..., description="Initial candidate URL requested")
    redirect_chain: list[str] = Field(
        default_factory=list, description="Ordered list of intermediate redirect URLs"
    )
    final_url: str = Field(..., description="Final landing URL retrieved")
    retrieved_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="Timestamp when content was retrieved",
    )
    source_family: SourceFamily = Field(..., description="Family of the source")
    content_hash: str = Field(..., description="SHA-256 hash of the raw captured content")
    raw_content_preview: str | None = Field(
        default=None, description="Bounded excerpt of the permitted raw content"
    )
    extraction_version: str = Field(
        default="extract_v1.0", description="Version of the text extraction pipeline"
    )
    excerpt_locator: ExcerptLocator | None = Field(
        default=None, description="Precise excerpt locator"
    )
    media_type: str = Field(default="text/html", description="MIME media type")
    availability: SnapshotAvailability = Field(
        default=SnapshotAvailability.AVAILABLE,
        description="Current availability status of the snapshot",
    )
    access_limitations: list[str] = Field(
        default_factory=list, description="Access restrictions or limitations"
    )
