"""BenchShield domain enumeration types according to the product blueprint."""

from enum import StrEnum


class TaskType(StrEnum):
    """Task types supported by BenchShield."""

    EXACT_SHORT_ANSWER = "exact_short_answer"
    MULTIPLE_CHOICE = "multiple_choice"
    # Unsupported types for input validation
    CODE_EXECUTION = "code_execution"
    OPEN_ENDED = "open_ended"
    RUBRIC_EVALUATION = "rubric_evaluation"
    IMAGE_MULTIMODAL = "image_multimodal"


class DataClassification(StrEnum):
    """Data classification level for policy and egress control."""

    PUBLIC = "public"
    SYNTHETIC = "synthetic"
    CONFIDENTIAL = "confidential"


class RetentionProfile(StrEnum):
    """Retention schedule profiles."""

    PILOT_STANDARD_30_90 = "pilot_standard_30_90"
    CUSTOM = "custom"
    IMMEDIATE_DELETION = "immediate_deletion"


class InvestigationStatus(StrEnum):
    """Lifecycle states of an investigation orchestrator."""

    QUEUED = "queued"
    VALIDATING = "validating"
    DISCOVERING = "discovering"
    VERIFYING = "verifying"
    AWAITING_REVIEW = "awaiting_review"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    POLICY_BLOCKED = "policy_blocked"
    BUDGET_EXHAUSTED = "budget_exhausted"


class ExposureType(StrEnum):
    """Independent exposure claim types."""

    METADATA = "metadata"
    QUESTION_CONTEXT = "question_context"
    WORKED_SOLUTION = "worked_solution"
    REFERENCE_ANSWER = "reference_answer"


class ClaimStatus(StrEnum):
    """Status of an individual exposure claim."""

    CANDIDATE = "candidate"
    VERIFIED = "verified"
    REJECTED = "rejected"
    NEEDS_REVIEW = "needs_review"


class TaskIdentity(StrEnum):
    """Assessment of whether discovered content represents the same evaluation task."""

    EXACT = "exact"
    EQUIVALENT = "equivalent"
    AMBIGUOUS = "ambiguous"
    DIFFERENT = "different"


class AnswerMatch(StrEnum):
    """Assessment of answer agreement between discovered content and reference."""

    EXACT = "exact"
    NORMALIZED = "normalized"
    TASK_SPECIFIC = "task_specific"
    MISMATCH = "mismatch"
    NOT_APPLICABLE = "not_applicable"


class TemporalStatus(StrEnum):
    """Temporal relationship of discovered evidence to the benchmark cutoff."""

    VERIFIED_PRE_CUTOFF = "verified_pre_cutoff"
    OBSERVED_POST_CUTOFF = "observed_post_cutoff"
    VERIFIED_INTRODUCED_POST_CUTOFF = "verified_introduced_post_cutoff"
    UNKNOWN = "unknown"


class SourceFamily(StrEnum):
    """Category of the source where evidence was discovered."""

    WEB_SEARCH = "web_search"
    CODE_REPOSITORY = "code_repository"
    ACADEMIC_ARCHIVE = "academic_archive"
    DISCUSSION_FORUM = "discussion_forum"
    OTHER = "other"


class SnapshotAvailability(StrEnum):
    """Current availability status of an evidence snapshot."""

    AVAILABLE = "available"
    INACCESSIBLE = "inaccessible"
    RESTRICTED = "restricted"
    EXPIRED = "expired"


class ReviewAction(StrEnum):
    """Action taken by a human reviewer on a finding."""

    CONFIRM = "confirm"
    REJECT = "reject"
    REQUEST_MORE_EVIDENCE = "request_more_evidence"


class ExperimentCondition(StrEnum):
    """Controlled conditions for attacker experiments."""

    CONTROL = "control"
    BLIND = "blind"
    EVALUATION_AWARE = "evaluation_aware"


class ExperimentRunStatus(StrEnum):
    """Execution status of an individual experimental run."""

    NOT_REQUESTED = "not_requested"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    POLICY_BLOCKED = "policy_blocked"
    BUDGET_EXHAUSTED = "budget_exhausted"
    INCOMPLETE = "incomplete"


class GraderOutcome(StrEnum):
    """Outcome of grading an attacker experiment model output."""

    CORRECT = "correct"
    INCORRECT = "incorrect"
    UNSUPPORTED = "unsupported"
    ERROR = "error"


class AttributionLevel(StrEnum):
    """Degree of attribution observed between retrieval and model output."""

    NONE = "none"
    RETRIEVAL_OBSERVED = "retrieval_observed"
    USE_SUPPORTED = "use_supported"
    INTERVENTION_SUPPORTED = "intervention_supported"


class PolicyCompliance(StrEnum):
    """Policy compliance result for an experiment run."""

    PERMITTED = "permitted"
    VIOLATED = "violated"
    UNKNOWN = "unknown"


class ReportStatus(StrEnum):
    """Status of an asynchronous report generation job."""

    QUEUED = "queued"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"


class ErrorCode(StrEnum):
    """Standard machine-readable error codes."""

    VALIDATION_FAILED = "validation_failed"
    POLICY_BLOCKED = "policy_blocked"
    BUDGET_EXHAUSTED = "budget_exhausted"
    PROVIDER_UNAVAILABLE = "provider_unavailable"
    UNSUPPORTED_GRADER = "unsupported_grader"
    NOT_FOUND = "not_found"
    VERSION_CONFLICT = "version_conflict"
    UNSUPPORTED_TASK_TYPE = "unsupported_task_type"
    FORBIDDEN = "forbidden"
    INTERNAL_ERROR = "internal_error"
    NOT_IMPLEMENTED = "not_implemented"


class EventType(StrEnum):
    """Types of Server-Sent Events emitted during an investigation."""

    INVESTIGATION_QUEUED = "investigation_queued"
    INVESTIGATION_STARTED = "investigation_started"
    PHASE_TRANSITION = "phase_transition"
    ITEM_INVESTIGATION_STARTED = "item_investigation_started"
    CANDIDATE_DISCOVERED = "candidate_discovered"
    VERIFICATION_COMPLETED = "verification_completed"
    BUDGET_UPDATED = "budget_updated"
    INVESTIGATION_COMPLETED = "investigation_completed"
    INVESTIGATION_FAILED = "investigation_failed"
    INVESTIGATION_CANCELLED = "investigation_cancelled"
    INVESTIGATION_BLOCKED = "investigation_blocked"
    SNAPSHOT_REFRESH_REQUIRED = "snapshot_refresh_required"
