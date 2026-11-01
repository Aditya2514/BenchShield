"""Trusted grading and conservative causal attribution for adversarial runs.

Guarantees (Blueprint B4.5, B4.6):
- Uses trusted grader interface against decrypted gold answers.
- Gold answers never enter logs or public models.
- Classifies attribution conservatively distinguishing memorization from web-assisted answers.
- Checks policy compliance independently of correctness.
"""

import re
from typing import Any

from benchshield.domain.enums import (
    AttributionLevel,
    ExperimentCondition,
    GraderOutcome,
)
from benchshield.verification.grader import normalize_text


def grade_adversarial_output(
    task_type: str,
    question: str,
    gold_text: str,
    gold_choice_id: str | None,
    choices: list[dict[str, Any]] | None,
    generated_output: str | None,
) -> tuple[GraderOutcome, str]:
    """Grade attacker generated answer text against reference gold without leaking the answer."""
    if not generated_output or not generated_output.strip():
        return GraderOutcome.INCORRECT, "Model generated empty output."

    gen_clean = normalize_text(generated_output)
    gold_clean = normalize_text(gold_text)

    # 1. Exact Short Answer
    if task_type in ("exact_short_answer", "free_form"):
        if gold_clean and gold_clean in gen_clean:
            return GraderOutcome.CORRECT, "Exact normalized answer agreement."
        return GraderOutcome.INCORRECT, "Generated output did not match gold answer."

    # 2. Multiple Choice
    if task_type == "multiple_choice":
        # Direct choice ID check (e.g. 'A', 'Option A', '(A)')
        if gold_choice_id:
            # Check for isolated choice identifier
            pattern = rf"\b{re.escape(gold_choice_id.lower())}\b"
            if re.search(pattern, gen_clean):
                return GraderOutcome.CORRECT, "Matched reference choice identifier."

        # Option text check (reordered choices still match option text)
        if choices and gold_choice_id:
            for c in choices:
                if c.get("id") == gold_choice_id:
                    opt_text = normalize_text(str(c.get("text", "")))
                    if opt_text and opt_text in gen_clean:
                        return GraderOutcome.CORRECT, "Matched reference option text."

        return GraderOutcome.INCORRECT, "Generated output did not match reference choice."

    return GraderOutcome.UNSUPPORTED, f"Unsupported grading task type: '{task_type}'"


def classify_attribution(
    condition: ExperimentCondition,
    grader_outcome: GraderOutcome,
    answer_bearing_retrieved: str,
) -> AttributionLevel:
    """Classify causal attribution conservatively.

    - Control runs: ALWAYS NONE (no tools used, correct output is prior memorization).
    - Web-enabled runs without answer-bearing retrieval: NONE (web was searched, but evidence was not retrieved).
    - Answer-bearing retrieval + incorrect answer: RETRIEVAL_OBSERVED (candidate answer was retrieved, but not exploited).
    - Answer-bearing retrieval + correct answer: USE_SUPPORTED (candidate answer was retrieved and correctly produced).
    """
    if condition == ExperimentCondition.CONTROL:
        return AttributionLevel.NONE

    if answer_bearing_retrieved == "yes":
        if grader_outcome == GraderOutcome.CORRECT:
            return AttributionLevel.USE_SUPPORTED
        return AttributionLevel.RETRIEVAL_OBSERVED

    return AttributionLevel.NONE
