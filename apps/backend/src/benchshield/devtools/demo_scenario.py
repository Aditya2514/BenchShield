"""Synthetic audit scenario covering the B3 fixture cases end to end.

Every item and web page here is synthetic. The fake web returns pages keyed by
words that appear in the planner's queries, so discovery runs fully offline.
"""

from benchshield.web.adapter_interface import SearchResultItem
from benchshield.web.fake_web_adapter import FakeWebAdapter

DEMO_BENCHMARK = {
    "name": "Synthetic Exposure Audit Demo",
    "items": [
        {
            "external_id": "SYN-001",
            "task_type": "exact_short_answer",
            "question": "What is the primary power generation mechanism of fictional Station K-9?",
            "gold_answer": "Sub-surface thorium reactor",
            "metadata": {"domain": "sci_fi_engineering", "difficulty": "medium"},
        },
        {
            "external_id": "SYN-002",
            "task_type": "multiple_choice",
            "question": "Which fictional station holds registration code K7?",
            "choices": [
                {"id": "A", "text": "North Station"},
                {"id": "B", "text": "East Station"},
                {"id": "C", "text": "South Station"},
                {"id": "D", "text": "West Station"},
            ],
            "gold_answer": "B",
            "metadata": {"domain": "sci_fi_registry", "difficulty": "easy"},
        },
        {
            "external_id": "SYN-003",
            "task_type": "exact_short_answer",
            "question": "What is the atomic number of carbon?",
            "gold_answer": "6",
            "metadata": {"domain": "chemistry", "difficulty": "easy"},
        },
        {
            "external_id": "SYN-004",
            "task_type": "exact_short_answer",
            "question": "Which fictional river feeds the orbital desalination ring of Meridia?",
            "gold_answer": "Vellan Stream",
            "metadata": {"domain": "sci_fi_geography", "difficulty": "hard"},
        },
    ],
}

DEMO_POLICY = {
    "name": "Demo public-benchmark exposure policy",
    "allowed_tools": ["search", "scrape"],
    "allowed_source_classes": ["web_search", "code_repository", "academic_archive"],
    "prohibited_answer_key_access": True,
    "benchmark_identification_permitted": False,
    "evaluation_cutoff": "2024-01-01T00:00:00Z",
    "cutoff_timezone": "UTC",
    "max_queries_per_item": 3,
    "max_fetches_per_item": 3,
    "max_concurrent_discovery_tasks": 2,
    "deadline_seconds": 600,
    "cost_ceiling_usd": 5.0,
    "data_classification": "synthetic",
    "retention_profile": "pilot_standard_30_90",
    "reviewer_identity": "alice@corp-alpha.com",
}

# keyword (matched against planner query, lowercased) -> [(url, title, page content)]
DEMO_PAGES: dict[str, list[tuple[str, str, str]]] = {
    "power generation": [
        (
            "https://github.com/leaky-org/eval-dump/blob/main/k9.md",
            "eval-dump: leaked items",
            "# Leaked eval items\n\nQ: What is the primary power generation mechanism of "
            "fictional Station K-9?\nA: Sub-surface thorium reactor\n",
        ),
        (
            "https://forum.example-discussions.net/t/station-k9",
            "Forum thread about Station K-9",
            "Anyone know: what is the primary power generation mechanism of fictional "
            "Station K-9? I could not find it in the lore wiki.",
        ),
    ],
    "registration code": [
        (
            "https://arxiv.org/abs/2401.00001",
            "Appendix with shuffled options",
            "Example item: Which fictional station holds registration code K7?\n"
            "(A) West Station (B) South Station (C) East Station (D) North Station\n"
            "Correct: East Station",
        ),
    ],
    "carbon": [
        (
            "https://chem-quiz.example-edu.org/carbon",
            "Chemistry quiz",
            "Quiz 3. What is the atomic number of carbon? Answer: 6. Next: page 6 of 10.",
        ),
    ],
    "meridia": [
        (
            "https://travel.example-blog.com/meridia-ring",
            "Meridia travel blog",
            "Our trip to the Meridia ring: amazing desalination tour, great food, 10/10.",
        ),
    ],
}


class DemoWebAdapter(FakeWebAdapter):
    """Fake web that serves DEMO_PAGES. Offline-safe."""

    def __init__(self):
        super().__init__()
        for pages in DEMO_PAGES.values():
            for url, _title, content in pages:
                self.register_snapshot(url, content)

    async def fetch(self, url: str, max_bytes: int = 500_000):
        # The SSRF guard resolves hostnames via DNS. Scripted pages are served from memory
        # (no network request), so the DNS check is skipped for them only; any other URL
        # still goes through the full SSRF validation.
        self.bypass_ssrf_check = url in self.fetch_registry
        try:
            return await super().fetch(url, max_bytes=max_bytes)
        finally:
            self.bypass_ssrf_check = False

    async def search(self, query: str, max_results: int = 10) -> list[SearchResultItem]:
        self.search_calls.append(query)
        q = query.lower()
        results: list[SearchResultItem] = []
        for key, pages in DEMO_PAGES.items():
            if key in q:
                for i, (url, title, content) in enumerate(pages, start=1):
                    results.append(
                        SearchResultItem(
                            url=url,
                            title=title,
                            snippet=content[:120],
                            position=i,
                            domain=url.split("/")[2],
                        )
                    )
        return results[:max_results]
