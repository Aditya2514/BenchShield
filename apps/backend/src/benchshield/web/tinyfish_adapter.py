"""Production TinyFish controlled web adapter for bounded search and content fetching.

Guarantees:
- Enforces pre-request SSRF validation on all URLs.
- Bounded snapshot size ceiling.
- Translates upstream SDK exceptions to standard domain error types.
- Never sends vault secrets or gold answers to the web adapter.
"""

import hashlib
import logging
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

logger = logging.getLogger("benchshield.web.tinyfish")


class TinyFishAdapter(SearchAdapter, FetchAdapter):
    """Controlled web adapter wrapping the TinyFish SDK."""

    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("TinyFish API key must be provided")
        from tinyfish import AsyncTinyFish

        self.api_key = api_key
        self.client = AsyncTinyFish(api_key=api_key)

    async def search(self, query: str, max_results: int = 10) -> list[SearchResultItem]:
        """Execute web search through TinyFish Search API."""
        if not query or not query.strip():
            return []

        try:
            response = await self.client.search.query(query=query.strip(), location="US")
            results: list[SearchResultItem] = []
            raw_items = getattr(response, "results", []) or []

            for idx, item in enumerate(raw_items[:max_results], start=1):
                raw_url = getattr(item, "url", "")
                if not raw_url:
                    continue

                # Parse domain
                parsed = urllib.parse.urlsplit(raw_url)
                domain = parsed.hostname or ""

                results.append(
                    SearchResultItem(
                        url=raw_url,
                        title=getattr(item, "title", "") or domain,
                        snippet=getattr(item, "snippet", "") or "",
                        position=getattr(item, "position", idx),
                        domain=domain,
                    )
                )

            return results
        except TimeoutError as err:
            raise UpstreamTimeoutError(
                f"TinyFish search timed out for query: {err}",
                provider="tinyfish",
            ) from err
        except Exception as err:
            err_str = str(err).lower()
            if "rate" in err_str or "429" in err_str:
                raise RateLimitExceededError(
                    f"TinyFish rate limit exceeded: {err}",
                    provider="tinyfish",
                ) from err
            raise ProviderUnavailableError(
                f"TinyFish search provider failed: {err}",
                provider="tinyfish",
            ) from err

    async def fetch(self, url: str, max_bytes: int = 500_000) -> FetchSnapshotResult:
        """Fetch page content as markdown via TinyFish Fetch API with SSRF boundaries."""
        # 1. Enforce strict SSRF check before outbound connection
        validated_url = validate_url_safe_for_fetch(url)

        try:
            response = await self.client.fetch.get_contents(urls=[validated_url], format="markdown")
            raw_items = getattr(response, "results", []) or []
            if not raw_items:
                raise ProviderUnavailableError(
                    f"TinyFish fetch returned empty result for {validated_url}",
                    provider="tinyfish",
                )

            item = raw_items[0]
            raw_text = getattr(item, "text", "") or ""
            text_bytes = raw_text.encode("utf-8")

            # 2. Check and enforce content size limit
            if len(text_bytes) > max_bytes:
                # Bounded snapshot truncation to preserve evidence up to ceiling
                raw_text = text_bytes[:max_bytes].decode("utf-8", errors="replace")
                text_bytes = raw_text.encode("utf-8")
                logger.warning(
                    "Fetched content from %s exceeded %d bytes; truncated to ceiling",
                    validated_url,
                    max_bytes,
                )

            sha = hashlib.sha256(text_bytes).hexdigest()
            title = getattr(item, "title", "") or ""
            final_url = getattr(item, "url", validated_url) or validated_url

            return FetchSnapshotResult(
                url=validated_url,
                final_url=final_url,
                redirect_chain=[],
                title=title,
                content=raw_text,
                content_sha256=sha,
                media_type="text/markdown",
                size_bytes=len(text_bytes),
            )
        except TimeoutError as err:
            raise UpstreamTimeoutError(
                f"TinyFish fetch timed out for {validated_url}: {err}",
                provider="tinyfish",
            ) from err
        except (
            ContentSizeLimitExceededError,
            UpstreamTimeoutError,
            RateLimitExceededError,
            ProviderUnavailableError,
        ):
            raise
        except Exception as err:
            err_str = str(err).lower()
            if "rate" in err_str or "429" in err_str:
                raise RateLimitExceededError(
                    f"TinyFish fetch rate limit: {err}",
                    provider="tinyfish",
                ) from err
            raise ProviderUnavailableError(
                f"TinyFish fetch error: {err}",
                provider="tinyfish",
            ) from err
