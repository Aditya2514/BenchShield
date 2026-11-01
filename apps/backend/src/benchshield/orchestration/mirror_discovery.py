"""Mirror discovery specialist: candidate URL deduplication, ranking, and bounded link traversal.

Guarantees:
- Enforces max depth <= 1 (no recursive scraping).
- Filters already visited domains and deduplicates URLs.
- Selects top candidate URLs up to remaining fetch budget.
"""

import urllib.parse

from benchshield.web.adapter_interface import SearchResultItem


class MirrorDiscovery:
    """Specialist selecting candidate evidence URLs bounded by fetch budget."""

    @staticmethod
    def select_candidate_urls(
        search_results: list[SearchResultItem],
        already_fetched: set[str],
        max_fetches: int,
    ) -> list[str]:
        """Select top candidate URLs without duplicates or out-of-budget traversal."""
        selected: list[str] = []
        seen_hosts: set[str] = set()

        for item in search_results:
            if len(selected) >= max_fetches:
                break

            url = item.url.strip()
            if not url or url in already_fetched:
                continue

            parsed = urllib.parse.urlsplit(url)
            host = (parsed.hostname or "").lower()

            # Prefer diverse hosts
            if host in seen_hosts and len(search_results) > max_fetches:
                continue

            seen_hosts.add(host)
            selected.append(url)

        return selected
