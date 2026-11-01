"""Server-Sent Events (SSE) models, typed payload variants, and envelopes.

Guarantees:
- Discriminated, allowlisted event payloads. Arbitrary dictionaries are forbidden.
- Protected reference answers and secrets are strictly excluded from event models.
- Reconnect ordering semantics enforced via monotonic event IDs.
"""

from datetime import UTC, datetime
from typing import Any, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from benchshield.domain.enums import (
    AnswerMatch,
    ClaimStatus,
    EventType,
    ExposureType,
    InvestigationStatus,
    SourceFamily,
    TaskIdentity,
    TemporalStatus,
)


class BaseEventPayload(BaseModel):
    """Base class for all typed event data payloads."""

    model_config = ConfigDict(extra="forbid")


class InvestigationQueuedPayload(BaseEventPayload):
    """Payload when investigation is placed in execution queue."""

    benchmark_version_id: str = Field(..., description="Target benchmark version ID")
    total_items: int = Field(..., description="Total items in scope", ge=1)
    policy_version_id: str = Field(..., description="Active policy version ID")


class InvestigationStartedPayload(BaseEventPayload):
    """Payload when investigation begins execution."""

    benchmark_version_id: str = Field(..., description="Target benchmark version ID")
    total_items: int = Field(..., description="Total items in scope", ge=1)


class PhaseTransitionPayload(BaseEventPayload):
    """Payload when investigation transitions between orchestration phases."""

    from_phase: str = Field(..., description="Previous phase name")
    to_phase: str = Field(..., description="New active phase name")


class ItemInvestigationStartedPayload(BaseEventPayload):
    """Payload when discovery begins on a specific benchmark item."""

    item_version_id: str = Field(..., description="Item version ID")
    external_id: str = Field(..., description="Item external ID")
    item_index: int = Field(..., description="1-indexed item number", ge=1)


class CandidateDiscoveredPayload(BaseEventPayload):
    """Payload when a candidate exposure source is found."""

    item_version_id: str = Field(..., description="Target item version ID")
    external_id: str = Field(..., description="Item external ID")
    source_url: str = Field(..., description="Discovered source URL")
    source_family: SourceFamily = Field(..., description="Source family category")


class VerificationCompletedPayload(BaseEventPayload):
    """Payload when evidence verification finishes for an item."""

    item_version_id: str = Field(..., description="Target item version ID")
    external_id: str = Field(..., description="Item external ID")
    exposure_type: ExposureType = Field(..., description="Determined exposure type")
    claim_status: ClaimStatus = Field(..., description="Claim status")
    task_identity: TaskIdentity = Field(..., description="Task correspondence")
    answer_match: AnswerMatch = Field(..., description="Answer agreement")
    temporal_status: TemporalStatus = Field(..., description="Temporal classification")


class BudgetUpdatedPayload(BaseEventPayload):
    """Payload tracking resource consumption."""

    used_queries: int = Field(..., description="Queries consumed so far", ge=0)
    max_queries: int = Field(..., description="Max queries allowed", ge=0)
    used_fetches: int = Field(..., description="Fetches consumed so far", ge=0)
    max_fetches: int = Field(..., description="Max fetches allowed", ge=0)
    used_cost_usd: float = Field(..., description="Cost incurred in USD", ge=0.0)
    cost_ceiling_usd: float = Field(..., description="Cost ceiling in USD", ge=0.0)


# Backwards compatibility alias
InvestigationProgressEventData = BudgetUpdatedPayload
CandidateDiscoveredEventData = CandidateDiscoveredPayload


class InvestigationCompletedPayload(BaseEventPayload):
    """Payload when investigation reaches terminal completion."""

    status: InvestigationStatus = Field(..., description="Terminal status")
    total_items: int = Field(..., description="Total items in benchmark", ge=0)
    investigated_items: int = Field(..., description="Items processed", ge=0)
    findings_count: int = Field(..., description="Total findings verified or flagged", ge=0)
    is_partial: bool = Field(..., description="Whether investigation coverage is partial")


class InvestigationFailedPayload(BaseEventPayload):
    """Payload when investigation fails."""

    failure_code: str = Field(..., description="Error code")
    message: str = Field(..., description="Sanitized failure explanation")


class InvestigationCancelledPayload(BaseEventPayload):
    """Payload when investigation is cancelled."""

    cancelled_at: datetime = Field(..., description="Cancellation timestamp")
    reason: str = Field(..., description="Sanitized cancellation reason")


class InvestigationBlockedPayload(BaseEventPayload):
    """Payload when investigation is blocked by policy."""

    reason: str = Field(..., description="Policy rule that blocked investigation")


class SnapshotRefreshRequiredPayload(BaseEventPayload):
    """Payload emitted when reconnect cursor is expired and state refresh is needed."""

    last_known_event_id: str = Field(..., description="Client supplied cursor")
    investigation_id: str = Field(..., description="Investigation ID")
    message: str = Field(
        default="Reconnect cursor expired; please refresh full investigation snapshot from GET /api/v1/investigations/{id}",
        description="Instruction to fetch full snapshot",
    )


SnapshotRefreshRequiredEventData = SnapshotRefreshRequiredPayload

EVENT_PAYLOAD_MAP: dict[EventType, type[BaseEventPayload]] = {
    EventType.INVESTIGATION_QUEUED: InvestigationQueuedPayload,
    EventType.INVESTIGATION_STARTED: InvestigationStartedPayload,
    EventType.PHASE_TRANSITION: PhaseTransitionPayload,
    EventType.ITEM_INVESTIGATION_STARTED: ItemInvestigationStartedPayload,
    EventType.CANDIDATE_DISCOVERED: CandidateDiscoveredPayload,
    EventType.VERIFICATION_COMPLETED: VerificationCompletedPayload,
    EventType.BUDGET_UPDATED: BudgetUpdatedPayload,
    EventType.INVESTIGATION_COMPLETED: InvestigationCompletedPayload,
    EventType.INVESTIGATION_FAILED: InvestigationFailedPayload,
    EventType.INVESTIGATION_CANCELLED: InvestigationCancelledPayload,
    EventType.INVESTIGATION_BLOCKED: InvestigationBlockedPayload,
    EventType.SNAPSHOT_REFRESH_REQUIRED: SnapshotRefreshRequiredPayload,
}

AnyEventPayload = (
    InvestigationQueuedPayload
    | InvestigationStartedPayload
    | PhaseTransitionPayload
    | ItemInvestigationStartedPayload
    | CandidateDiscoveredPayload
    | VerificationCompletedPayload
    | BudgetUpdatedPayload
    | InvestigationCompletedPayload
    | InvestigationFailedPayload
    | InvestigationCancelledPayload
    | InvestigationBlockedPayload
    | SnapshotRefreshRequiredPayload
)


class SSEEventEnvelope(BaseModel):
    """Authoritative SSE event envelope with typed, allowlisted payload validation.

    CRITICAL BOUNDARY: Arbitrary payload dictionaries are forbidden. The payload must
    strictly match the typed schema associated with the event type.
    """

    model_config = ConfigDict(extra="forbid")

    event_id: str = Field(
        ..., description="Monotonically increasing event ID for reconnect ordering", min_length=1
    )
    investigation_id: str = Field(..., description="Target investigation identifier", min_length=1)
    type: EventType = Field(..., description="Machine-readable event type")
    schema_version: str = Field(default="1.0", description="Event contract schema version")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Event generation timestamp (UTC)"
    )
    data: AnyEventPayload = Field(
        ..., description="Strictly typed event payload (arbitrary dictionaries are rejected)"
    )

    @model_validator(mode="before")
    @classmethod
    def parse_and_validate_payload(cls, values: Any) -> Any:
        if isinstance(values, dict):
            event_type = values.get("type")
            raw_data = values.get("data")
            if event_type and isinstance(event_type, str):
                try:
                    event_type_enum = EventType(event_type)
                except ValueError:
                    return values
                expected_cls = EVENT_PAYLOAD_MAP.get(event_type_enum)
                if expected_cls and isinstance(raw_data, dict):
                    # Validate dict into strictly typed payload (extra='forbid' will catch secrets)
                    values["data"] = expected_cls.model_validate(raw_data)
        return values

    @model_validator(mode="after")
    def validate_payload_matches_type(self) -> Self:
        expected_cls = EVENT_PAYLOAD_MAP.get(self.type)
        if expected_cls and not isinstance(self.data, expected_cls):
            raise ValueError(
                f"Payload type '{type(self.data).__name__}' does not match expected payload '{expected_cls.__name__}' for event type '{self.type.value}'"
            )
        return self
