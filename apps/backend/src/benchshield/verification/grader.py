"""Deterministic trusted grader for B3 evidence verification.

Order of checks (blueprint B3.2/B3.3):
1. Task identity: does the source contain *this* task? Checked before answers.
2. Answer agreement: only meaningful once identity holds. Multiple-choice answers
   are matched on option text, so reordered choices still match.
3. Temporal assessment: independent of the answer; unknown timing never downgrades
   a verified exposure, and a late observation stays observed_post_cutoff.

The grader never returns or logs the gold answer; explanations describe the
match category only.
"""

import re
import unicodedata
from dataclasses import dataclass
from datetime import UTC, datetime

from benchshield.domain.enums import (
    AnswerMatch,
    ClaimStatus,
    ExposureType,
    TaskIdentity,
    TaskType,
    TemporalStatus,
)

GRADER_VERSION = "grader_v1.1"
NORMALIZATION_VERSION = "norm_v1.0"

# Identity thresholds on question-token coverage inside the source text.
EQUIVALENT_COVERAGE = 0.85
AMBIGUOUS_COVERAGE = 0.5
# Answers this short collide with unrelated text ("4", "B", "yes"); never auto-verify them
# unless the task identity is exact.
COMMON_ANSWER_MAX_LEN = 3
# A short answer only counts as "found" for verification if it appears within this many
# normalized characters after the exact question text (e.g. GSM8K's "#### 18" line).
ANSWER_PROXIMITY_CHARS = 1500

_PUNCT_RE = re.compile(r"[^\w\s]", re.UNICODE)
_WS_RE = re.compile(r"\s+")
_STOPWORDS = {
    "a",
    "an",
    "the",
    "of",
    "is",
    "what",
    "which",
    "in",
    "on",
    "for",
    "to",
    "and",
    "or",
    "by",
    "with",
    "its",
    "it",
    "are",
    "was",
    "be",
    "does",
    "do",
    "how",
    "many",
}


def normalize_text(text: str) -> str:
    """norm_v1.0: NFKC, casefold, punctuation -> space, collapse whitespace."""
    text = unicodedata.normalize("NFKC", text or "").casefold()
    text = _PUNCT_RE.sub(" ", text)
    return _WS_RE.sub(" ", text).strip()


def _tokens(text: str) -> list[str]:
    return [t for t in normalize_text(text).split(" ") if t and t not in _STOPWORDS]


def _contains_phrase(haystack_norm: str, needle_norm: str) -> bool:
    if not needle_norm:
        return False
    return f" {needle_norm} " in f" {haystack_norm} "


@dataclass(frozen=True)
class GradeResult:
    task_identity: TaskIdentity
    answer_match: AnswerMatch
    exposure_type: ExposureType
    claim_status: ClaimStatus
    question_coverage: float
    identity_explanation: str
    answer_explanation: str
    claim_rationale: str
    common_answer_risk: bool


def assess_task_identity(question: str, source_text: str) -> tuple[TaskIdentity, float, str]:
    q_norm = normalize_text(question)
    s_norm = normalize_text(source_text)
    if q_norm and _contains_phrase(s_norm, q_norm):
        return TaskIdentity.EXACT, 1.0, "Full normalized question text appears in the source."
    q_tokens = _tokens(question)
    if not q_tokens:
        return TaskIdentity.DIFFERENT, 0.0, "Question has no comparable content tokens."
    s_tokens = set(s_norm.split(" "))
    coverage = sum(1 for t in q_tokens if t in s_tokens) / len(q_tokens)
    if coverage >= EQUIVALENT_COVERAGE:
        return (
            TaskIdentity.EQUIVALENT,
            coverage,
            f"{coverage:.0%} of question content tokens present; wording differs.",
        )
    if coverage >= AMBIGUOUS_COVERAGE:
        return (
            TaskIdentity.AMBIGUOUS,
            coverage,
            f"Only {coverage:.0%} of question content tokens present; identity unresolved.",
        )
    return (
        TaskIdentity.DIFFERENT,
        coverage,
        f"{coverage:.0%} of question content tokens present; source is a different task.",
    )


def assess_answer(
    task_type: str,
    gold_text: str,
    source_text: str,
    identity: TaskIdentity,
) -> tuple[AnswerMatch, str]:
    if identity == TaskIdentity.DIFFERENT:
        return AnswerMatch.NOT_APPLICABLE, "Answer not assessed: task identity not established."
    if task_type not in (TaskType.EXACT_SHORT_ANSWER, TaskType.MULTIPLE_CHOICE):
        return AnswerMatch.NOT_APPLICABLE, f"No trusted grader for task type '{task_type}'."
    gold_norm = normalize_text(gold_text)
    if not gold_norm:
        return AnswerMatch.NOT_APPLICABLE, "Reference answer empty after normalization."

    if task_type == TaskType.MULTIPLE_CHOICE:
        if _contains_phrase(normalize_text(source_text), gold_norm):
            return (
                AnswerMatch.TASK_SPECIFIC,
                "Correct option text present in source (matched by option text, order-independent).",
            )
        return AnswerMatch.MISMATCH, "Correct option text not found in source."

    if gold_text.strip() and gold_text.strip() in source_text:
        return AnswerMatch.EXACT, "Reference answer appears verbatim in source."
    if _contains_phrase(normalize_text(source_text), gold_norm):
        return AnswerMatch.NORMALIZED, f"Reference answer matches after {NORMALIZATION_VERSION}."
    return AnswerMatch.MISMATCH, "Reference answer not found in source."


def answer_near_question(question: str, gold_text: str, source_text: str) -> bool:
    """True if the normalized answer appears shortly after any exact occurrence of the question."""
    q_norm, g_norm = normalize_text(question), normalize_text(gold_text)
    s_norm = f" {normalize_text(source_text)} "
    if not q_norm or not g_norm:
        return False
    needle, start = f" {q_norm} ", 0
    while (idx := s_norm.find(needle, start)) >= 0:
        end = idx + len(needle) - 1
        window = s_norm[end : end + ANSWER_PROXIMITY_CHARS + 1]
        if f" {g_norm} " in f"{window} ":
            return True
        start = idx + 1
    return False


def grade(task_type: str, question: str, gold_text: str, source_text: str) -> GradeResult:
    identity, coverage, id_expl = assess_task_identity(question, source_text)
    answer, ans_expl = assess_answer(task_type, gold_text, source_text, identity)
    answer_found = answer in (AnswerMatch.EXACT, AnswerMatch.NORMALIZED, AnswerMatch.TASK_SPECIFIC)
    common_risk = answer_found and len(normalize_text(gold_text)) <= COMMON_ANSWER_MAX_LEN
    if common_risk and identity == TaskIdentity.EXACT:
        if answer_near_question(question, gold_text, source_text):
            common_risk = False
            ans_expl += (
                f" Short answer appears within {ANSWER_PROXIMITY_CHARS} chars after the question."
            )
        else:
            ans_expl += " Short answer only appears far from the question; possible coincidence."

    if identity == TaskIdentity.DIFFERENT:
        exposure, status = ExposureType.METADATA, ClaimStatus.REJECTED
        rationale = "Source does not contain this task; rejected as unrelated."
    elif answer_found:
        exposure = ExposureType.REFERENCE_ANSWER
        if identity == TaskIdentity.EXACT and not (
            common_risk and task_type != TaskType.MULTIPLE_CHOICE
        ):
            status = ClaimStatus.VERIFIED
            rationale = "Exact task text and the reference answer both appear in the source."
        elif identity == TaskIdentity.EQUIVALENT and not common_risk:
            status = ClaimStatus.VERIFIED
            rationale = "Equivalent task text and the reference answer both appear in the source."
        else:
            status = ClaimStatus.NEEDS_REVIEW
            rationale = (
                "Answer text found but it is short/common or task identity is not exact; "
                "possible common-answer collision, sent to review."
                if common_risk
                else "Answer text found but task identity is ambiguous; sent to review."
            )
    else:
        exposure = ExposureType.QUESTION_CONTEXT
        if identity == TaskIdentity.EXACT:
            status = ClaimStatus.VERIFIED
            rationale = "Exact task text appears in the source without the reference answer."
        else:
            status = ClaimStatus.NEEDS_REVIEW
            rationale = "Partial task text overlap without the reference answer; sent to review."

    return GradeResult(
        task_identity=identity,
        answer_match=answer,
        exposure_type=exposure,
        claim_status=status,
        question_coverage=coverage,
        identity_explanation=id_expl,
        answer_explanation=ans_expl,
        claim_rationale=rationale,
        common_answer_risk=common_risk,
    )


def _parse_dt(value) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def assess_temporal(
    cutoff: datetime,
    retrieved_at: datetime | None,
    evidence_metadata: dict | None,
) -> tuple[TemporalStatus, dict]:
    """Classify timing. Only commit/archive/verified-introduction times count as evidence;
    an asserted page date is recorded but never trusted on its own."""
    meta = evidence_metadata or {}
    cutoff = _parse_dt(cutoff)
    retrieved = _parse_dt(retrieved_at)
    commit = _parse_dt(meta.get("commit_time"))
    archive = _parse_dt(meta.get("archive_capture_time"))
    introduced = _parse_dt(meta.get("verified_introduction_time"))
    asserted = _parse_dt(meta.get("published_at"))
    times = {
        "retrieval_time": retrieved,
        "commit_time": commit,
        "archive_capture_time": archive,
        "verified_introduction_time": introduced,
        "asserted_publication_time": asserted,
    }
    trusted = [t for t in (introduced, commit, archive) if t is not None]
    if trusted:
        earliest = min(trusted)
        if earliest <= cutoff:
            return TemporalStatus.VERIFIED_PRE_CUTOFF, {
                **times,
                "note": "Commit/archive/introduction evidence predates the evaluation cutoff.",
            }
        if introduced is not None and introduced > cutoff:
            return TemporalStatus.VERIFIED_INTRODUCED_POST_CUTOFF, {
                **times,
                "note": "Verified introduction time is after the evaluation cutoff.",
            }
    if retrieved is not None and retrieved <= cutoff:
        return TemporalStatus.VERIFIED_PRE_CUTOFF, {
            **times,
            "note": "Source was retrieved before the evaluation cutoff.",
        }
    if retrieved is not None:
        return TemporalStatus.OBSERVED_POST_CUTOFF, {
            **times,
            "note": "Observed after cutoff; no evidence of when it was introduced.",
        }
    return TemporalStatus.UNKNOWN, {**times, "note": "No usable timestamps."}
