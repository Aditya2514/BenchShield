"""Controlled web adapters, SSRF validation, and search/fetch interfaces."""

from benchshield.web.adapter_interface import (
    ContentSizeLimitExceededError,
    FetchAdapter,
    FetchSnapshotResult,
    ProviderUnavailableError,
    RateLimitExceededError,
    SearchAdapter,
    SearchResultItem,
    UpstreamTimeoutError,
    WebAdapterError,
)
from benchshield.web.fake_web_adapter import FakeWebAdapter
from benchshield.web.ssrf_protection import SSRFViolationError, validate_url_safe_for_fetch
from benchshield.web.tinyfish_adapter import TinyFishAdapter

__all__ = [
    "ContentSizeLimitExceededError",
    "FakeWebAdapter",
    "FetchAdapter",
    "FetchSnapshotResult",
    "ProviderUnavailableError",
    "RateLimitExceededError",
    "SSRFViolationError",
    "SearchAdapter",
    "SearchResultItem",
    "TinyFishAdapter",
    "UpstreamTimeoutError",
    "WebAdapterError",
    "validate_url_safe_for_fetch",
]
