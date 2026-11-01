"""Profiler specialist: extracts search terms and features from public benchmark items.

Guarantees:
- Works strictly on public item versions (question, choices, allowlisted metadata).
- Never accesses vault or gold answers.
"""

import re
from dataclasses import dataclass, field

from benchshield.persistence.models import ItemVersionModel


@dataclass(frozen=True)
class ItemProfile:
    """Distinctive public features and extracted search seeds for an item."""

    item_version_id: str
    external_id: str
    task_type: str
    question_snippet: str
    key_terms: list[str] = field(default_factory=list)
    distinctive_phrases: list[str] = field(default_factory=list)
    domain: str = "general"


class BenchmarkProfiler:
    """Specialist that derives public search queries from benchmark item content."""

    @staticmethod
    def profile_item(item: ItemVersionModel) -> ItemProfile:
        """Derive search profile using public item content only."""
        question_clean = " ".join(item.question.split()).strip()

        # Extract question snippet (up to 100 characters, break at word boundary)
        snippet = question_clean[:100]
        if len(question_clean) > 100:
            last_space = snippet.rfind(" ")
            if last_space > 40:
                snippet = snippet[:last_space]

        # Extract words longer than 5 chars as key terms
        words = re.findall(r"\b[A-Za-z0-9_-]{5,}\b", question_clean)
        # Deduplicate while preserving order
        seen = set()
        key_terms = []
        for w in words:
            w_lower = w.lower()
            if w_lower not in seen and len(key_terms) < 5:
                seen.add(w_lower)
                key_terms.append(w)

        # Extract 4-6 word consecutive phrases
        tokens = question_clean.split()
        distinctive_phrases = []
        if len(tokens) >= 5:
            phrase = " ".join(tokens[:5])
            distinctive_phrases.append(phrase)
        if len(tokens) >= 10:
            phrase_mid = " ".join(tokens[4:9])
            distinctive_phrases.append(phrase_mid)

        domain = "general"
        if isinstance(item.metadata_, dict):
            domain = item.metadata_.get("domain", item.metadata_.get("subject", "general"))

        return ItemProfile(
            item_version_id=item.id,
            external_id=item.external_id,
            task_type=item.task_type,
            question_snippet=snippet,
            key_terms=key_terms,
            distinctive_phrases=distinctive_phrases,
            domain=domain,
        )
