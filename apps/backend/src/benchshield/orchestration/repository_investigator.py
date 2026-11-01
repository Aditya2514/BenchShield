"""Repository investigator specialist: executes code and dataset repository searches."""

from benchshield.web.adapter_interface import SearchAdapter, SearchResultItem


class RepositoryInvestigator:
    """Specialist executing bounded repository searches against public code hosts."""

    def __init__(self, search_adapter: SearchAdapter):
        self.search_adapter = search_adapter

    async def execute_query(self, query: str, max_results: int = 5) -> list[SearchResultItem]:
        """Execute code repository query and filter for relevant hosts."""
        results = await self.search_adapter.search(query, max_results=max_results)
        return results
