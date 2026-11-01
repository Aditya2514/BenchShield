"""Deterministic fake web search and fetch adapter for testing and offline execution."""

import hashlib
import urllib.parse

from benchshield.web.adapter_interface import (
    ContentSizeLimitExceededError,
    FetchAdapter,
    FetchSnapshotResult,
    ProviderUnavailableError,
    RateLimitExceededError,
    SearchAdapter,
    SearchResultItem,
    UpstreamTimeoutError,
)
from benchshield.web.ssrf_protection import validate_url_safe_for_fetch


class FakeWebAdapter(SearchAdapter, FetchAdapter):
    """Deterministic, configurable web adapter with fault injection support."""

    def __init__(self):
        self.search_registry: dict[str, list[SearchResultItem]] = {}
        self.fetch_registry: dict[str, str] = {}
        self.redirect_registry: dict[str, list[str]] = {}

        # Fault injection toggles
        self.inject_timeout = False
        self.inject_rate_limit = False
        self.inject_provider_error = False
        self.inject_oversized = False
        self.bypass_ssrf_check = False

        # Metrics / call counts
        self.search_calls: list[str] = []
        self.fetch_calls: list[str] = []

    def register_search_result(self, query_substring: str, results: list[SearchResultItem]) -> None:
        """Register specific search results when query contains query_substring."""
        self.search_registry[query_substring.lower()] = results

    def register_snapshot(self, url: str, content: str, redirects: list[str] | None = None) -> None:
        """Register specific page content for a URL."""
        self.fetch_registry[url] = content
        if redirects:
            self.redirect_registry[url] = redirects

    async def search(self, query: str, max_results: int = 10) -> list[SearchResultItem]:
        """Perform simulated deterministic search."""
        self.search_calls.append(query)

        if self.inject_timeout:
            raise UpstreamTimeoutError("Simulated upstream search timeout", provider="fake_search")
        if self.inject_rate_limit:
            raise RateLimitExceededError(
                "Simulated upstream rate limit exceeded", provider="fake_search"
            )
        if self.inject_provider_error:
            raise ProviderUnavailableError(
                "Simulated 503 Provider Unavailable", provider="fake_search"
            )

        q_lower = query.lower()
        for sub, items in self.search_registry.items():
            if sub in q_lower:
                return items[:max_results]

        # Default fallback synthetic result
        domain = "github.com" if "repo" in q_lower or "github" in q_lower else "arxiv.org"
        slug = hashlib.md5(query.encode("utf-8")).hexdigest()[:8]
        synthetic_url = f"https://{domain}/search/results-{slug}"
        return [
            SearchResultItem(
                url=synthetic_url,
                title=f"Discovered candidate repository: {query[:40]}",
                snippet=f"Synthetic matching snippet for query: {query}",
                position=1,
                domain=domain,
            )
        ][:max_results]

    async def fetch(self, url: str, max_bytes: int = 500_000) -> FetchSnapshotResult:
        """Perform simulated deterministic URL fetch with SSRF boundary check."""
        self.fetch_calls.append(url)

        if not self.bypass_ssrf_check:
            # Validate URL against SSRF rules
            validate_url_safe_for_fetch(url)

        if self.inject_timeout:
            raise UpstreamTimeoutError("Simulated upstream fetch timeout", provider="fake_fetch")
        if self.inject_rate_limit:
            raise RateLimitExceededError(
                "Simulated upstream fetch rate limit", provider="fake_fetch"
            )
        if self.inject_provider_error:
            raise ProviderUnavailableError(
                "Simulated upstream fetch 500 server error", provider="fake_fetch"
            )

        if self.inject_oversized:
            content = "X" * (max_bytes + 1024)
            raise ContentSizeLimitExceededError(
                f"Fetched content of {len(content)} bytes exceeds ceiling of {max_bytes} bytes",
                provider="fake_fetch",
            )

        # Retrieve registered content or synthetic content
        redirects = self.redirect_registry.get(url, [])
        final_url = redirects[-1] if redirects else url

        # Re-validate final URL in redirect chain if redirects occurred
        if redirects and not self.bypass_ssrf_check:
            for red_url in redirects:
                validate_url_safe_for_fetch(red_url)

        content = self.fetch_registry.get(
            url,
            self.fetch_registry.get(
                final_url,
                f"Synthetic snapshot content for {url}\nObserved context matching candidate search.",
            ),
        )

        content_bytes = content.encode("utf-8")
        if len(content_bytes) > max_bytes:
            raise ContentSizeLimitExceededError(
                f"Content size {len(content_bytes)} exceeds {max_bytes}",
                provider="fake_fetch",
            )

        sha = hashlib.sha256(content_bytes).hexdigest()
        parsed = urllib.parse.urlsplit(final_url)

        return FetchSnapshotResult(
            url=url,
            final_url=final_url,
            redirect_chain=redirects,
            title=f"Snapshot from {parsed.hostname}",
            content=content,
            content_sha256=sha,
            media_type="text/markdown",
            size_bytes=len(content_bytes),
        )
