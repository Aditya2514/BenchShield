"""State machine definitions, valid transitions, and optimistic concurrency validators."""

from benchshield.domain.enums import ExperimentRunStatus, InvestigationStatus


class StateTransitionError(Exception):
    """Raised when an illegal lifecycle state transition is attempted."""

    def __init__(self, current_state: str, attempted_state: str, valid_targets: set[str]):
        self.current_state = current_state
        self.attempted_state = attempted_state
        self.valid_targets = valid_targets
        super().__init__(
            f"Cannot transition from '{current_state}' to '{attempted_state}'. "
            f"Valid targets: {sorted(valid_targets) if valid_targets else 'None (terminal state)'}."
        )


class VersionConflictError(Exception):
    """Raised when an optimistic concurrency version conflict occurs."""

    def __init__(self, expected_version: int, actual_version: int):
        self.expected_version = expected_version
        self.actual_version = actual_version
        super().__init__(
            f"Version conflict: expected version {expected_version}, but entity is at version {actual_version}."
        )


# Authoritative investigation transitions according to blueprint
INVESTIGATION_TRANSITIONS: dict[InvestigationStatus, set[InvestigationStatus]] = {
    InvestigationStatus.QUEUED: {
        InvestigationStatus.VALIDATING,
        InvestigationStatus.CANCELLED,
    },
    InvestigationStatus.VALIDATING: {
        InvestigationStatus.DISCOVERING,
        InvestigationStatus.FAILED,
        InvestigationStatus.CANCELLED,
        InvestigationStatus.POLICY_BLOCKED,
    },
    InvestigationStatus.DISCOVERING: {
        InvestigationStatus.VERIFYING,
        InvestigationStatus.FAILED,
        InvestigationStatus.CANCELLED,
        InvestigationStatus.POLICY_BLOCKED,
        InvestigationStatus.BUDGET_EXHAUSTED,
    },
    InvestigationStatus.VERIFYING: {
        InvestigationStatus.AWAITING_REVIEW,
        InvestigationStatus.COMPLETED,
        InvestigationStatus.FAILED,
        InvestigationStatus.CANCELLED,
    },
    InvestigationStatus.AWAITING_REVIEW: {
        InvestigationStatus.COMPLETED,
        InvestigationStatus.CANCELLED,
    },
    # Terminal states have no valid transitions
    InvestigationStatus.COMPLETED: set(),
    InvestigationStatus.FAILED: set(),
    InvestigationStatus.CANCELLED: set(),
    InvestigationStatus.POLICY_BLOCKED: set(),
    InvestigationStatus.BUDGET_EXHAUSTED: set(),
}

EXPERIMENT_TRANSITIONS: dict[ExperimentRunStatus, set[ExperimentRunStatus]] = {
    ExperimentRunStatus.NOT_REQUESTED: {ExperimentRunStatus.QUEUED},
    ExperimentRunStatus.QUEUED: {
        ExperimentRunStatus.RUNNING,
        ExperimentRunStatus.CANCELLED,
    },
    ExperimentRunStatus.RUNNING: {
        ExperimentRunStatus.COMPLETED,
        ExperimentRunStatus.FAILED,
        ExperimentRunStatus.CANCELLED,
        ExperimentRunStatus.POLICY_BLOCKED,
        ExperimentRunStatus.BUDGET_EXHAUSTED,
        ExperimentRunStatus.INCOMPLETE,
    },
    # Terminal states
    ExperimentRunStatus.COMPLETED: set(),
    ExperimentRunStatus.FAILED: set(),
    ExperimentRunStatus.CANCELLED: set(),
    ExperimentRunStatus.POLICY_BLOCKED: set(),
    ExperimentRunStatus.BUDGET_EXHAUSTED: set(),
    ExperimentRunStatus.INCOMPLETE: set(),
}


def validate_investigation_transition(
    current: InvestigationStatus,
    target: InvestigationStatus,
) -> bool:
    """Validate whether an investigation state transition is permitted.

    Raises:
        StateTransitionError: If the transition is illegal.
    """
    valid_targets = INVESTIGATION_TRANSITIONS.get(current, set())
    if target not in valid_targets:
        raise StateTransitionError(
            current_state=current.value,
            attempted_state=target.value,
            valid_targets={s.value for s in valid_targets},
        )
    return True


def validate_experiment_transition(
    current: ExperimentRunStatus,
    target: ExperimentRunStatus,
) -> bool:
    """Validate whether an experiment state transition is permitted.

    Raises:
        StateTransitionError: If the transition is illegal.
    """
    valid_targets = EXPERIMENT_TRANSITIONS.get(current, set())
    if target not in valid_targets:
        raise StateTransitionError(
            current_state=current.value,
            attempted_state=target.value,
            valid_targets={s.value for s in valid_targets},
        )
    return True


def check_and_bump_version(expected_version: int, current_version: int) -> int:
    """Check optimistic concurrency version and return incremented version.

    Raises:
        VersionConflictError: If expected_version does not match current_version.
    """
    if expected_version != current_version:
        raise VersionConflictError(
            expected_version=expected_version, actual_version=current_version
        )
    return current_version + 1
