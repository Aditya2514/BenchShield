"""Typed interfaces, normalized errors, and usage accounting for external adapters."""

from abc import ABC, abstractmethod
from datetime import UTC, datetime

from pydantic import BaseModel, Field

from benchshield.domain.enums import GraderOutcome, SourceFamily, TaskType
from benchshield.domain.models.benchmarks import ChoiceOption
from benchshield.domain.models.evidence import SourceSnapshot
from benchshield.domain.models.intake import GoldVaultRecord


class AdapterError(Exception):
    """Base error for adapter operations."""

    def __init__(self, message: str, provider: str, error_code: str = "adapter_error"):
        self.message = message
        self.provider = provider
        self.error_code = error_code
        super().__init__(f"[{provider}] {error_code}: {message}")


class AdapterTimeoutError(AdapterError):
    """Raised when an adapter call times out."""

    def __init__(self, message: str, provider: str):
        super().__init__(message, provider, error_code="timeout")


class AdapterRateLimitError(AdapterError):
    """Raised when an external provider rate limit is encountered."""

    def __init__(self, message: str, provider: str, retry_after_seconds: float | None = None):
        self.retry_after_seconds = retry_after_seconds
        super().__init__(message, provider, error_code="rate_limit")


class AdapterContentPolicyError(AdapterError):
    """Raised when a query or page violates outbound/content security policy."""

    def __init__(self, message: str, provider: str):
        super().__init__(message, provider, error_code="content_policy_violation")


class AdapterUnavailableError(AdapterError):
    """Raised when the remote provider or service is unreachable."""

    def __init__(self, message: str, provider: str):
        super().__init__(message, provider, error_code="provider_unavailable")


class UsageRecord(BaseModel):
    """Resource and monetary usage accounting for an adapter invocation."""

    queries_count: int = Field(default=0, ge=0)
    fetches_count: int = Field(default=0, ge=0)
    input_tokens: int = Field(default=0, ge=0)
    output_tokens: int = Field(default=0, ge=0)
    cost_usd: float = Field(default=0.0, ge=0.0)
    latency_ms: float = Field(default=0.0, ge=0.0)


class AdapterMetadata(BaseModel):
    """Identifier and version metadata of an adapter."""

    provider_name: str
    model_or_service_id: str
    revision: str | None = None
    adapter_version: str = "1.0.0"


class SearchResult(BaseModel):
    """Single candidate search match."""

    title: str
    url: str
    snippet: str
    source_family: SourceFamily = SourceFamily.WEB_SEARCH


class FetchedPage(BaseModel):
    """Result of fetching an external URL."""

    final_url: str
    redirect_chain: list[str] = Field(default_factory=list)
    status_code: int = 200
    content: str
    content_hash: str
    media_type: str = "text/html"
    retrieved_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class SearchAdapter(ABC):
    """Interface for public web search adapters."""

    @property
    @abstractmethod
    def metadata(self) -> AdapterMetadata:
        """Adapter metadata."""
        pass

    @abstractmethod
    def search(
        self,
        query: str,
        max_results: int = 5,
        timeout_seconds: float = 10.0,
    ) -> tuple[list[SearchResult], UsageRecord]:
        """Execute a search query within policy constraints."""
        pass


class FetchAdapter(ABC):
    """Interface for fetching web pages."""

    @property
    @abstractmethod
    def metadata(self) -> AdapterMetadata:
        """Adapter metadata."""
        pass

    @abstractmethod
    def fetch(
        self,
        url: str,
        timeout_seconds: float = 10.0,
        max_bytes: int = 1_000_000,
    ) -> tuple[FetchedPage, UsageRecord]:
        """Fetch and normalize an external page without executing scripts."""
        pass


class ModelReasoningAdapter(ABC):
    """Interface for structured LLM reasoning in bounded roles."""

    @property
    @abstractmethod
    def metadata(self) -> AdapterMetadata:
        """Adapter metadata."""
        pass

    @abstractmethod
    def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        max_tokens: int = 1000,
        temperature: float = 0.0,
        timeout_seconds: float = 30.0,
    ) -> tuple[str, UsageRecord]:
        """Generate structured reasoning text."""
        pass


class EvidenceStorageAdapter(ABC):
    """Interface for preserving raw and normalized evidence snapshots."""

    @abstractmethod
    def save_snapshot(self, snapshot: SourceSnapshot, raw_content: str | bytes) -> str:
        """Save evidence snapshot and return storage URI."""
        pass

    @abstractmethod
    def get_snapshot(self, snapshot_id: str) -> tuple[SourceSnapshot | None, str | bytes | None]:
        """Retrieve evidence snapshot and content."""
        pass


class GoldVaultAdapter(ABC):
    """Restricted interface for storing and querying protected reference answers.

    Must NEVER be called by investigator agents, search adapters, or public API routes.
    """

    @abstractmethod
    def store_gold_records(self, records: list[GoldVaultRecord]) -> None:
        """Store gold answers into isolated vault."""
        pass

    @abstractmethod
    def get_gold_record(
        self, benchmark_version_id: str, external_id: str
    ) -> GoldVaultRecord | None:
        """Retrieve gold answer for trusted grading only."""
        pass


class TrustedGradingAdapter(ABC):
    """Interface for grading candidate answers against vaulted reference answers."""

    @property
    @abstractmethod
    def grader_version(self) -> str:
        """Grader version."""
        pass

    @abstractmethod
    def grade(
        self,
        benchmark_version_id: str,
        external_id: str,
        candidate_answer: str,
        task_type: TaskType,
        choices: list[ChoiceOption] | None = None,
    ) -> tuple[GraderOutcome, str]:
        """Grade candidate answer against protected gold.

        Returns:
            (outcome, explanation) - NEVER returns or leaks the gold answer text.
        """
        pass
