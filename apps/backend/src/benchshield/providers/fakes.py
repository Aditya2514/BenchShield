"""Deterministic fake adapters for tests.

These fakes execute completely in-memory without making network requests or invoking live providers.
"""

import hashlib

from benchshield.domain.enums import GraderOutcome, TaskType
from benchshield.domain.models.benchmarks import ChoiceOption
from benchshield.domain.models.evidence import SourceSnapshot
from benchshield.domain.models.intake import GoldVaultRecord
from benchshield.providers.interfaces import (
    AdapterMetadata,
    AdapterRateLimitError,
    AdapterTimeoutError,
    AdapterUnavailableError,
    EvidenceStorageAdapter,
    FetchAdapter,
    FetchedPage,
    GoldVaultAdapter,
    ModelReasoningAdapter,
    SearchAdapter,
    SearchResult,
    TrustedGradingAdapter,
    UsageRecord,
)


class FakeSearchAdapter(SearchAdapter):
    """Deterministic in-memory search fake."""

    def __init__(self, responses: dict[str, list[SearchResult]] | None = None):
        self._responses = responses or {}
        self.call_history: list[str] = []
        self.should_timeout = False
        self.should_rate_limit = False
        self.should_fail = False

    @property
    def metadata(self) -> AdapterMetadata:
        return AdapterMetadata(
            provider_name="fake_search",
            model_or_service_id="fake_search_v1",
            adapter_version="1.0.0-fake",
        )

    def search(
        self,
        query: str,
        max_results: int = 5,
        timeout_seconds: float = 10.0,
    ) -> tuple[list[SearchResult], UsageRecord]:
        self.call_history.append(query)
        if self.should_timeout:
            raise AdapterTimeoutError(f"Search timed out after {timeout_seconds}s", "fake_search")
        if self.should_rate_limit:
            raise AdapterRateLimitError(
                "Rate limit exceeded", "fake_search", retry_after_seconds=5.0
            )
        if self.should_fail:
            raise AdapterUnavailableError("Service unavailable", "fake_search")

        results = self._responses.get(query, [])[:max_results]
        usage = UsageRecord(
            queries_count=1,
            fetches_count=0,
            input_tokens=0,
            output_tokens=0,
            cost_usd=0.005,
            latency_ms=12.5,
        )
        return results, usage


class FakeFetchAdapter(FetchAdapter):
    """Deterministic in-memory fetch fake."""

    def __init__(self, pages: dict[str, FetchedPage] | None = None):
        self._pages = pages or {}
        self.fetched_urls: list[str] = []
        self.should_timeout = False
        self.should_fail = False

    @property
    def metadata(self) -> AdapterMetadata:
        return AdapterMetadata(
            provider_name="fake_fetch",
            model_or_service_id="fake_fetch_v1",
            adapter_version="1.0.0-fake",
        )

    def fetch(
        self,
        url: str,
        timeout_seconds: float = 10.0,
        max_bytes: int = 1_000_000,
    ) -> tuple[FetchedPage, UsageRecord]:
        self.fetched_urls.append(url)
        if self.should_timeout:
            raise AdapterTimeoutError(f"Fetch timed out for {url}", "fake_fetch")
        if self.should_fail:
            raise AdapterUnavailableError(f"Could not connect to {url}", "fake_fetch")

        if url in self._pages:
            page = self._pages[url]
        else:
            content = f"<html><body>Deterministic content for {url}</body></html>"
            content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
            page = FetchedPage(
                final_url=url,
                redirect_chain=[],
                status_code=200,
                content=content,
                content_hash=content_hash,
            )

        usage = UsageRecord(
            queries_count=0,
            fetches_count=1,
            input_tokens=0,
            output_tokens=0,
            cost_usd=0.001,
            latency_ms=45.0,
        )
        return page, usage


class FakeModelReasoningAdapter(ModelReasoningAdapter):
    """Deterministic in-memory model reasoning fake."""

    def __init__(self, canned_response: str = "Deterministic model answer."):
        self.canned_response = canned_response
        self.prompts: list[str] = []

    @property
    def metadata(self) -> AdapterMetadata:
        return AdapterMetadata(
            provider_name="fake_llm",
            model_or_service_id="fake-reasoner-v1",
            revision="rev_20261101",
            adapter_version="1.0.0-fake",
        )

    def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        max_tokens: int = 1000,
        temperature: float = 0.0,
        timeout_seconds: float = 30.0,
    ) -> tuple[str, UsageRecord]:
        self.prompts.append(prompt)
        usage = UsageRecord(
            queries_count=0,
            fetches_count=0,
            input_tokens=len(prompt) // 4,
            output_tokens=len(self.canned_response) // 4,
            cost_usd=0.002,
            latency_ms=120.0,
        )
        return self.canned_response, usage


class FakeEvidenceStorageAdapter(EvidenceStorageAdapter):
    """In-memory evidence storage fake."""

    def __init__(self):
        self._snapshots: dict[str, SourceSnapshot] = {}
        self._raw_contents: dict[str, str | bytes] = {}

    def save_snapshot(self, snapshot: SourceSnapshot, raw_content: str | bytes) -> str:
        self._snapshots[snapshot.snapshot_id] = snapshot
        self._raw_contents[snapshot.snapshot_id] = raw_content
        return f"memory://snapshots/{snapshot.snapshot_id}"

    def get_snapshot(self, snapshot_id: str) -> tuple[SourceSnapshot | None, str | bytes | None]:
        return self._snapshots.get(snapshot_id), self._raw_contents.get(snapshot_id)


class FakeGoldVaultAdapter(GoldVaultAdapter):
    """Isolated in-memory vault for protected reference answers."""

    def __init__(self):
        self._vault: dict[tuple[str, str], GoldVaultRecord] = {}

    def store_gold_records(self, records: list[GoldVaultRecord]) -> None:
        for rec in records:
            self._vault[(rec.benchmark_version_id, rec.external_id)] = rec

    def get_gold_record(
        self, benchmark_version_id: str, external_id: str
    ) -> GoldVaultRecord | None:
        return self._vault.get((benchmark_version_id, external_id))


class FakeTrustedGradingAdapter(TrustedGradingAdapter):
    """Deterministic grading fake evaluating against the protected gold vault."""

    def __init__(self, vault: GoldVaultAdapter):
        self._vault = vault

    @property
    def grader_version(self) -> str:
        return "fake_grader_v1.0"

    def grade(
        self,
        benchmark_version_id: str,
        external_id: str,
        candidate_answer: str,
        task_type: TaskType,
        choices: list[ChoiceOption] | None = None,
    ) -> tuple[GraderOutcome, str]:
        gold = self._vault.get_gold_record(benchmark_version_id, external_id)
        if not gold:
            return GraderOutcome.ERROR, "Reference gold record not found in vault."

        clean_candidate = candidate_answer.strip()
        if not clean_candidate:
            return GraderOutcome.INCORRECT, "Candidate answer is empty."

        if task_type == TaskType.EXACT_SHORT_ANSWER:
            if clean_candidate.lower() == gold.gold_answer_text.strip().lower():
                return GraderOutcome.CORRECT, "Exact normalized short-answer agreement."
            return GraderOutcome.INCORRECT, "Candidate answer did not match reference."

        if task_type == TaskType.MULTIPLE_CHOICE:
            # Check if candidate matches gold choice ID or gold choice text
            cand_upper = clean_candidate.upper()
            if gold.gold_choice_id and cand_upper == gold.gold_choice_id.upper():
                return GraderOutcome.CORRECT, "Candidate matched reference choice ID."
            if clean_candidate.lower() == gold.gold_answer_text.strip().lower():
                return GraderOutcome.CORRECT, "Candidate matched reference option text."

            # Check reordered choices if provided
            if choices:
                for opt in choices:
                    if (
                        opt.id.upper() == cand_upper
                        and opt.text.strip().lower() == gold.gold_answer_text.strip().lower()
                    ):
                        return (
                            GraderOutcome.CORRECT,
                            "Candidate choice ID corresponds to correct option text.",
                        )

            return GraderOutcome.INCORRECT, "Candidate choice does not match reference."

        return GraderOutcome.UNSUPPORTED, f"Unsupported grading task type: {task_type}"
