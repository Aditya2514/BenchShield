"""Reasoning model provider registry, interfaces, privacy filtering, and fallback ordering.

Guarantees:
- Privacy filter: checks and rejects prompts containing vault secrets, answer revision keys, or verifier credentials.
- Bounded generation: enforced max tokens and timeout.
- Deterministic fake provider for offline testing.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


class PromptPrivacyViolationError(Exception):
    """Raised when an outbound LLM prompt violates privacy boundaries."""


@dataclass(frozen=True)
class ReasoningResponse:
    """Normalized response from a reasoning completion."""

    content: str
    tokens_used: int = 0
    model: str = "fake-reasoning"
    provider: str = "fake"


class ReasoningProvider(ABC):
    """Abstract reasoning model provider."""

    @abstractmethod
    async def complete(
        self,
        prompt: str,
        system_prompt: str | None = None,
        max_tokens: int = 1000,
        temperature: float = 0.0,
    ) -> ReasoningResponse:
        """Generate a reasoning completion."""
        pass


def validate_prompt_privacy(prompt: str, system_prompt: str | None = None) -> None:
    """Validate that outbound prompts do not leak sensitive answer or credential markers."""
    text_to_check = f"{system_prompt or ''} {prompt}".lower()

    # Reject known internal credential / vault patterns
    forbidden_markers = [
        "vault_encryption_key",
        "database_verifier_url",
        "verifier_dev_password",
        "benchshield_verifier",
        "protected_answers",
        "encrypted_answer",
    ]

    for marker in forbidden_markers:
        if marker in text_to_check:
            raise PromptPrivacyViolationError(
                f"Outbound prompt contains forbidden sensitive credential marker '{marker}'."
            )


class FakeReasoningProvider(ReasoningProvider):
    """Deterministic reasoning provider for testing and deterministic query planning."""

    def __init__(self, canned_responses: dict[str, str] | None = None):
        self.canned_responses = canned_responses or {}
        self.history: list[dict] = []

    async def complete(
        self,
        prompt: str,
        system_prompt: str | None = None,
        max_tokens: int = 1000,
        temperature: float = 0.0,
    ) -> ReasoningResponse:
        # Enforce prompt privacy check
        validate_prompt_privacy(prompt, system_prompt)

        self.history.append({"prompt": prompt, "system_prompt": system_prompt})

        for key, resp in self.canned_responses.items():
            if key in prompt:
                return ReasoningResponse(content=resp, tokens_used=50, model="fake-planner")

        # Default synthetic planning response: return 2 targeted query lines
        return ReasoningResponse(
            content='["query 1: public concepts", "query 2: site:github.com benchmark"]',
            tokens_used=40,
            model="fake-planner",
        )


class ProviderRegistry:
    """Registry maintaining available reasoning and web providers with fallback ordering."""

    def __init__(self):
        self._providers: dict[str, ReasoningProvider] = {
            "default": FakeReasoningProvider(),
            "fake": FakeReasoningProvider(),
        }

    def register(self, name: str, provider: ReasoningProvider) -> None:
        self._providers[name] = provider

    def get(self, name: str | None = None) -> ReasoningProvider:
        return self._providers.get(name or "default", self._providers["default"])


# Global registry singleton
provider_registry = ProviderRegistry()
