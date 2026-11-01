"""Controlled web adapter interfaces, data transfer models, and standard error types."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import UTC, datetime


@dataclass(frozen=True)
class SearchResultItem:
    """Normalized search query result item."""

    url: str
    title: str
    snippet: str = ""
    position: int = 1
    domain: str = ""


@dataclass(frozen=True)
class FetchSnapshotResult:
    """Normalized retrieved page snapshot."""

    url: str
    final_url: str
    redirect_chain: list[str] = field(default_factory=list)
    title: str = ""
    content: str = ""
    content_sha256: str = ""
    media_type: str = "text/plain"
    size_bytes: int = 0
    retrieved_at: datetime = field(default_factory=lambda: datetime.now(UTC))


# ---------------------------------------------------------------------------
# Error Hierarchy
# ---------------------------------------------------------------------------


class WebAdapterError(Exception):
    """Base exception for controlled web adapter operations."""

    def __init__(self, message: str, provider: str = "unknown"):
        super().__init__(message)
        self.provider = provider


class RateLimitExceededError(WebAdapterError):
    """Raised when upstream web search or scrape rate limits are reached."""


class UpstreamTimeoutError(WebAdapterError):
    """Raised when upstream web request times out."""


class ContentSizeLimitExceededError(WebAdapterError):
    """Raised when fetched web payload exceeds maximum allowed size."""


class ProviderUnavailableError(WebAdapterError):
    """Raised when web provider service is down or returns 5xx/network errors."""


# ---------------------------------------------------------------------------
# Abstract Adapter Interfaces
# ---------------------------------------------------------------------------


class SearchAdapter(ABC):
    """Abstract search adapter for discovering candidate exposure sources."""

    @abstractmethod
    async def search(self, query: str, max_results: int = 10) -> list[SearchResultItem]:
        """Execute a web search and return normalized results."""
        pass


class FetchAdapter(ABC):
    """Abstract fetch adapter for capturing evidence snapshots."""

    @abstractmethod
    async def fetch(self, url: str, max_bytes: int = 500_000) -> FetchSnapshotResult:
        """Fetch and extract snapshot content from a candidate URL."""
        pass
