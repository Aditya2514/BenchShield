"""B3 trusted grader: identity before answer, option-text MC matching, timing rules."""

from datetime import UTC, datetime

from benchshield.domain.enums import (
    AnswerMatch,
    ClaimStatus,
    ExposureType,
    TaskIdentity,
    TemporalStatus,
)
from benchshield.verification.grader import assess_temporal, grade, normalize_text

CUTOFF = datetime(2024, 1, 1, tzinfo=UTC)


def test_normalization_rules():
    assert normalize_text("  Sub-Surface  THORIUM, reactor! ") == "sub surface thorium reactor"


def test_exact_leak_is_verified_reference_answer():
    r = grade(
        "exact_short_answer",
        "What powers Station K-9?",
        "Thorium reactor",
        "Q: What powers Station K-9? A: Thorium reactor",
    )
    assert (r.task_identity, r.answer_match) == (TaskIdentity.EXACT, AnswerMatch.EXACT)
    assert r.claim_status == ClaimStatus.VERIFIED
    assert r.exposure_type == ExposureType.REFERENCE_ANSWER


def test_normalized_answer_match():
    r = grade(
        "exact_short_answer",
        "What powers Station K-9?",
        "Thorium-Reactor",
        "what powers station k 9 ... the thorium reactor",
    )
    assert r.answer_match == AnswerMatch.NORMALIZED


def test_reordered_choices_match_on_option_text():
    r = grade(
        "multiple_choice",
        "Which station holds code K7?",
        "East Station",
        "Which station holds code K7? (A) West Station (B) East Station. Correct: East Station",
    )
    assert r.answer_match == AnswerMatch.TASK_SPECIFIC
    assert r.claim_status == ClaimStatus.VERIFIED


def test_short_answer_far_from_question_needs_review():
    page = "What is the atomic number of carbon? " + "filler text " * 200 + "page 6"
    r = grade("exact_short_answer", "What is the atomic number of carbon?", "6", page)
    assert r.common_answer_risk and r.claim_status == ClaimStatus.NEEDS_REVIEW


def test_short_answer_right_after_question_is_verified():
    q = "Janet\u2019s ducks lay 16 eggs per day. How much does she make?"
    page = "Janet's ducks lay 16 eggs per day. How much does she make? #### 18"
    r = grade("exact_short_answer", q, "18", page)
    assert not r.common_answer_risk and r.claim_status == ClaimStatus.VERIFIED


def test_short_answer_with_only_equivalent_identity_needs_review():
    q = "Janet's ducks lay 16 eggs per day. How much does she make?"
    page = "janet ducks lay 16 eggs per day how much make she does 18"
    r = grade("exact_short_answer", q, "18", page)
    assert r.claim_status == ClaimStatus.NEEDS_REVIEW


def test_answer_without_task_identity_is_not_assessed():
    r = grade(
        "exact_short_answer",
        "Which river feeds Meridia ring?",
        "Vellan Stream",
        "Vellan Stream is a lovely place for a picnic.",
    )
    assert r.task_identity == TaskIdentity.DIFFERENT
    assert r.answer_match == AnswerMatch.NOT_APPLICABLE
    assert r.claim_status == ClaimStatus.REJECTED


def test_question_only_is_question_context():
    r = grade(
        "exact_short_answer",
        "What powers Station K-9?",
        "Thorium reactor",
        "Does anyone know what powers Station K-9?",
    )
    assert r.exposure_type == ExposureType.QUESTION_CONTEXT
    assert r.answer_match == AnswerMatch.MISMATCH


def test_unsupported_task_type_never_invents_match():
    r = grade(
        "open_ended",
        "Explain Station K-9.",
        "Because thorium",
        "Explain Station K-9. Because thorium",
    )
    assert r.answer_match == AnswerMatch.NOT_APPLICABLE


def test_late_observation_stays_post_cutoff():
    s, _ = assess_temporal(CUTOFF, datetime(2026, 1, 1, tzinfo=UTC), {"published_at": "2020-01-01"})
    assert s == TemporalStatus.OBSERVED_POST_CUTOFF  # asserted page date is not trusted


def test_commit_time_before_cutoff_verifies_pre_cutoff():
    s, _ = assess_temporal(
        CUTOFF, datetime(2026, 1, 1, tzinfo=UTC), {"commit_time": "2023-05-01T00:00:00Z"}
    )
    assert s == TemporalStatus.VERIFIED_PRE_CUTOFF


def test_no_timestamps_is_unknown():
    s, _ = assess_temporal(CUTOFF, None, {})
    assert s == TemporalStatus.UNKNOWN


def test_preview_masks_answer_only_where_grader_found_it():
    from benchshield.services.audit_service import (
        REDACTION_TOKEN,
        WITHHELD_PREVIEW,
        safe_preview,
    )

    page = "Quiz 3. What is the atomic number of carbon? Answer: 6. Next: page 6 of 10."
    # Answer found on the page: masked in place (the finding reports this exposure).
    masked = safe_preview(page, "6", "exact")
    assert "6" not in masked and REDACTION_TOKEN in masked

    # Answer only occurs incidentally: masking would reveal it, so withhold.
    unrelated = "Travel blog: see page 6 of 10 for the ring tour."
    assert safe_preview(unrelated, "6", "not_applicable") == WITHHELD_PREVIEW
    assert safe_preview(unrelated, "6", "mismatch") == WITHHELD_PREVIEW

    # No occurrence at all: preview unchanged.
    assert safe_preview("nothing here", "6", "mismatch") == "nothing here"
