"""Research investigator specialist: executes academic preprint and paper archive searches."""

from benchshield.web.adapter_interface import SearchAdapter, SearchResultItem


class ResearchInvestigator:
    """Specialist executing bounded preprint and academic archive queries."""

    def __init__(self, search_adapter: SearchAdapter):
        self.search_adapter = search_adapter

    async def execute_query(self, query: str, max_results: int = 5) -> list[SearchResultItem]:
        """Execute preprint search."""
        return await self.search_adapter.search(query, max_results=max_results)
