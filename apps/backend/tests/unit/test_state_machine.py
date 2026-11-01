"""Tests for state machines, legal transitions, and optimistic concurrency."""

import pytest

from benchshield.domain.enums import ExperimentRunStatus, InvestigationStatus
from benchshield.verification.state_machine import (
    StateTransitionError,
    VersionConflictError,
    check_and_bump_version,
    validate_experiment_transition,
    validate_investigation_transition,
)


def test_valid_investigation_transitions():
    """Verify normal progression of an investigation."""
    # queued -> validating -> discovering -> verifying -> completed
    assert validate_investigation_transition(
        InvestigationStatus.QUEUED, InvestigationStatus.VALIDATING
    )
    assert validate_investigation_transition(
        InvestigationStatus.VALIDATING, InvestigationStatus.DISCOVERING
    )
    assert validate_investigation_transition(
        InvestigationStatus.DISCOVERING, InvestigationStatus.VERIFYING
    )
    assert validate_investigation_transition(
        InvestigationStatus.VERIFYING, InvestigationStatus.AWAITING_REVIEW
    )
    assert validate_investigation_transition(
        InvestigationStatus.AWAITING_REVIEW, InvestigationStatus.COMPLETED
    )


def test_investigation_cancellation_from_active_states():
    """Verify cancellation is permitted from any non-terminal state."""
    active_states = [
        InvestigationStatus.QUEUED,
        InvestigationStatus.VALIDATING,
        InvestigationStatus.DISCOVERING,
        InvestigationStatus.VERIFYING,
        InvestigationStatus.AWAITING_REVIEW,
    ]
    for state in active_states:
        assert validate_investigation_transition(state, InvestigationStatus.CANCELLED)


def test_illegal_investigation_transitions_raise_error():
    """Verify illegal jumps or backward transitions are rejected."""
    # Terminal state cannot transition anywhere
    terminal_states = [
        InvestigationStatus.COMPLETED,
        InvestigationStatus.FAILED,
        InvestigationStatus.CANCELLED,
        InvestigationStatus.POLICY_BLOCKED,
        InvestigationStatus.BUDGET_EXHAUSTED,
    ]
    for term in terminal_states:
        with pytest.raises(StateTransitionError):
            validate_investigation_transition(term, InvestigationStatus.DISCOVERING)

    # Illegal jump: QUEUED directly to COMPLETED or VERIFYING
    with pytest.raises(StateTransitionError):
        validate_investigation_transition(InvestigationStatus.QUEUED, InvestigationStatus.COMPLETED)

    # Backward transition: VERIFYING back to QUEUED
    with pytest.raises(StateTransitionError):
        validate_investigation_transition(InvestigationStatus.VERIFYING, InvestigationStatus.QUEUED)


def test_valid_and_invalid_experiment_transitions():
    """Verify experiment run lifecycle rules."""
    assert validate_experiment_transition(
        ExperimentRunStatus.NOT_REQUESTED, ExperimentRunStatus.QUEUED
    )
    assert validate_experiment_transition(ExperimentRunStatus.QUEUED, ExperimentRunStatus.RUNNING)
    assert validate_experiment_transition(
        ExperimentRunStatus.RUNNING, ExperimentRunStatus.COMPLETED
    )
    assert validate_experiment_transition(
        ExperimentRunStatus.RUNNING, ExperimentRunStatus.INCOMPLETE
    )

    # Incomplete run is terminal and cannot transition to completed
    with pytest.raises(StateTransitionError):
        validate_experiment_transition(
            ExperimentRunStatus.INCOMPLETE, ExperimentRunStatus.COMPLETED
        )


def test_optimistic_concurrency_version_bump():
    """Verify optimistic concurrency check increments version on match and fails on conflict."""
    current_version = 3
    # Matching version succeeds and bumps
    new_version = check_and_bump_version(expected_version=3, current_version=current_version)
    assert new_version == 4

    # Stale expected version raises VersionConflictError
    with pytest.raises(VersionConflictError) as exc_info:
        check_and_bump_version(expected_version=2, current_version=current_version)

    assert exc_info.value.expected_version == 2
    assert exc_info.value.actual_version == 3
