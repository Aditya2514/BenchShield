"""Tests for domain model contracts, independent dimensions, and temporal semantics."""

from datetime import UTC, datetime

from benchshield.domain.enums import (
    AnswerMatch,
    AttributionLevel,
    ClaimStatus,
    ExperimentCondition,
    ExperimentRunStatus,
    ExposureType,
    GraderOutcome,
    PolicyCompliance,
    TaskIdentity,
    TemporalStatus,
)
from benchshield.domain.models.experiments import AdversarialRun
from benchshield.domain.models.findings import EvidenceClaim, TemporalAssessment, VerificationResult


def test_independent_finding_dimensions():
    """Verify that task identity, answer agreement, exposure type, and temporal status are independent."""
    # Scenario: Exact question, but answer is completely mismatched
    claim = EvidenceClaim(
        claim_id="clm_01",
        exposure_type=ExposureType.QUESTION_CONTEXT,
        claim_status=ClaimStatus.VERIFIED,
        rationale="Question wording found verbatim online",
    )
    verification = VerificationResult(
        verification_id="vrf_01",
        task_identity=TaskIdentity.EXACT,
        answer_match=AnswerMatch.MISMATCH,
        explanation="Question is identical, but online text provides an incorrect answer.",
    )
    temporal = TemporalAssessment(
        assessment_id="tmp_01",
        temporal_status=TemporalStatus.UNKNOWN,
    )

    assert claim.claim_status == ClaimStatus.VERIFIED
    assert verification.task_identity == TaskIdentity.EXACT
    assert verification.answer_match == AnswerMatch.MISMATCH
    assert temporal.temporal_status == TemporalStatus.UNKNOWN


def test_temporal_assessment_defaults_to_unknown_when_timing_missing():
    """Missing or unverified timing evidence must remain UNKNOWN and not be assumed pre-cutoff."""
    temporal = TemporalAssessment(
        assessment_id="tmp_02",
        retrieval_time=datetime.now(UTC),
        asserted_publication_time=None,
        archive_capture_time=None,
    )
    assert temporal.temporal_status == TemporalStatus.UNKNOWN


def test_post_cutoff_observation_stays_observed_post_cutoff():
    """Content first observed or committed after cutoff must not be claimed as verified pre-cutoff."""
    temporal = TemporalAssessment(
        assessment_id="tmp_03",
        temporal_status=TemporalStatus.OBSERVED_POST_CUTOFF,
        retrieval_time=datetime(2026, 11, 1, 12, 0, tzinfo=UTC),
        commit_time=datetime(2026, 10, 15, 0, 0, tzinfo=UTC),
    )
    assert temporal.temporal_status == TemporalStatus.OBSERVED_POST_CUTOFF
    assert temporal.temporal_status != TemporalStatus.VERIFIED_PRE_CUTOFF


def test_incomplete_experiment_distinct_from_incorrect_or_failed():
    """Incomplete experiments must be marked INCOMPLETE and distinct from INCORRECT answers."""
    run = AdversarialRun(
        run_id="run_01",
        experiment_id="exp_01",
        item_version_id="itv_01",
        condition=ExperimentCondition.BLIND,
        run_status=ExperimentRunStatus.INCOMPLETE,
        source_discovered="unknown",
        answer_bearing_content_retrieved="unknown",
        grader_outcome=GraderOutcome.UNSUPPORTED,
        attribution=AttributionLevel.NONE,
        policy_compliance=PolicyCompliance.UNKNOWN,
        failure_reason="Provider socket timeout during step 2",
    )

    assert run.run_status == ExperimentRunStatus.INCOMPLETE
    assert run.grader_outcome != GraderOutcome.INCORRECT


def test_prohibited_retrieval_with_incorrect_answer():
    """Verify that policy violation (prohibited retrieval) can occur even when the model answer is incorrect."""
    run = AdversarialRun(
        run_id="run_02",
        experiment_id="exp_01",
        item_version_id="itv_02",
        condition=ExperimentCondition.EVALUATION_AWARE,
        run_status=ExperimentRunStatus.COMPLETED,
        source_discovered="yes",
        answer_bearing_content_retrieved="yes",
        grader_outcome=GraderOutcome.INCORRECT,  # Model copied wrong part or hallucinated
        attribution=AttributionLevel.RETRIEVAL_OBSERVED,
        policy_compliance=PolicyCompliance.VIOLATED,
    )

    assert run.policy_compliance == PolicyCompliance.VIOLATED
    assert run.grader_outcome == GraderOutcome.INCORRECT
    assert run.attribution == AttributionLevel.RETRIEVAL_OBSERVED
