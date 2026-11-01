"""Query planner specialist: generates bounded, policy-compliant search hypotheses."""

from dataclasses import dataclass, field

from benchshield.orchestration.benchmark_profiler import ItemProfile
from benchshield.persistence.models import EvaluationPolicyVersionModel

FORBIDDEN_ANSWER_KEY_PATTERNS = [
    "answer key",
    "solution manual",
    "chegg",
    "quizlet",
    "test bank",
    "exam solutions",
]


@dataclass(frozen=True)
class PlannedHypothesis:
    """Hypothesis with associated candidate search queries."""

    hypothesis_type: str  # code_repository, academic_archive, web_search, exact_match
    rationale: str
    queries: list[str] = field(default_factory=list)


class QueryPlanner:
    """Specialist generating targeted search hypotheses bounded by policy."""

    @staticmethod
    def plan_hypotheses(
        profile: ItemProfile,
        policy: EvaluationPolicyVersionModel,
        benchmark_name: str | None = None,
    ) -> list[PlannedHypothesis]:
        """Generate structured discovery hypotheses adhering to policy boundaries."""
        hypotheses: list[PlannedHypothesis] = []
        max_queries = policy.max_queries_per_item or 3

        # 1. Exact phrase hypothesis
        exact_query = f'"{profile.question_snippet}"'
        hypotheses.append(
            PlannedHypothesis(
                hypothesis_type="exact_match",
                rationale="Audit public web search for literal item question text.",
                queries=[exact_query],
            )
        )

        # 2. Code repository hypothesis
        code_terms = " ".join(profile.key_terms[:2])
        if code_terms:
            code_query = f"site:github.com {code_terms}"
            hypotheses.append(
                PlannedHypothesis(
                    hypothesis_type="code_repository",
                    rationale="Audit public GitHub codebases and evaluation harnesses.",
                    queries=[code_query],
                )
            )

        # 3. Academic paper / research hypothesis
        if profile.distinctive_phrases:
            phrase = profile.distinctive_phrases[0]
            research_query = f"site:arxiv.org {phrase}"
            hypotheses.append(
                PlannedHypothesis(
                    hypothesis_type="academic_archive",
                    rationale="Audit public preprint archives for benchmark dataset release.",
                    queries=[research_query],
                )
            )

        # Policy checks and bounding
        planned: list[PlannedHypothesis] = []
        collected_queries = 0

        for hyp in hypotheses:
            if collected_queries >= max_queries:
                break

            filtered_queries: list[str] = []
            for q in hyp.queries:
                if collected_queries >= max_queries:
                    break

                q_lower = q.lower()

                # Enforce prohibited answer key access rule
                if policy.prohibited_answer_key_access and any(
                    bad in q_lower for bad in FORBIDDEN_ANSWER_KEY_PATTERNS
                ):
                    continue

                # Enforce benchmark identification rule
                if (
                    not policy.benchmark_identification_permitted
                    and benchmark_name
                    and benchmark_name.lower() in q_lower
                ):
                    continue

                filtered_queries.append(q)
                collected_queries += 1

            if filtered_queries:
                planned.append(
                    PlannedHypothesis(
                        hypothesis_type=hyp.hypothesis_type,
                        rationale=hyp.rationale,
                        queries=filtered_queries,
                    )
                )

        return planned
