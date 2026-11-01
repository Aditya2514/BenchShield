"""Budget reservation and accounting service.

Enforces:
- Atomic pre-dispatch reservation of queries, fetches, tokens, and monetary spend.
- Fast rejection before calling external search/fetch providers if budget is exhausted.
- Accounting in integer minor units (cost_cents).
"""

from uuid import uuid4

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from benchshield.domain.models.investigations import InvestigationBudgets
from benchshield.persistence.models import BudgetReservationModel, InvestigationModel


class BudgetExhaustedException(Exception):
    """Raised when an operation would exceed the configured resource budget."""

    def __init__(self, resource_type: str, requested: int, available: int):
        super().__init__(
            f"Resource budget exhausted for '{resource_type}'. Requested: {requested}, Available: {available}."
        )
        self.resource_type = resource_type
        self.requested = requested
        self.available = available


class BudgetService:
    """Service managing atomic reservations and usage reconciliation."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def reserve_budget(
        self,
        investigation: InvestigationModel,
        resource_type: str,  # "queries", "fetches", "tokens", "cost_cents"
        amount: int,
        task_id: str | None = None,
    ) -> BudgetReservationModel:
        """Atomically verify and reserve budget before dispatch."""
        if amount <= 0:
            raise ValueError("Reservation amount must be positive.")

        budget_cfg = investigation.budget_config or {}

        # Determine ceiling
        if resource_type == "queries":
            ceiling = budget_cfg.get("max_queries", 50)
        elif resource_type == "fetches":
            ceiling = budget_cfg.get("max_fetches", 50)
        elif resource_type == "tokens":
            ceiling = budget_cfg.get("max_tokens", 500_000)
        elif resource_type == "cost_cents":
            # Convert cost_ceiling_usd to cents if needed
            ceiling = int(
                budget_cfg.get("max_cost_cents", budget_cfg.get("cost_ceiling_usd", 10.0) * 100)
            )
        else:
            ceiling = 1000

        # Query active reservations + committed usage
        stmt = select(
            func.coalesce(
                func.sum(
                    case(
                        (
                            BudgetReservationModel.status == "committed",
                            BudgetReservationModel.used_amount,
                        ),
                        (
                            BudgetReservationModel.status == "reserved",
                            BudgetReservationModel.reserved_amount,
                        ),
                        else_=0,
                    )
                ),
                0,
            )
        ).where(
            BudgetReservationModel.investigation_id == investigation.id,
            BudgetReservationModel.resource_type == resource_type,
            BudgetReservationModel.status.in_(["reserved", "committed"]),
        )
        result = await self.db.execute(stmt)
        current_allocated = result.scalar() or 0

        available = ceiling - current_allocated
        if amount > available:
            raise BudgetExhaustedException(
                resource_type=resource_type,
                requested=amount,
                available=max(0, available),
            )

        # Create reservation record
        reservation = BudgetReservationModel(
            id=f"bres_{uuid4().hex[:16]}",
            workspace_id=investigation.workspace_id,
            investigation_id=investigation.id,
            task_id=task_id,
            resource_type=resource_type,
            reserved_amount=amount,
            used_amount=0,
            status="reserved",
        )
        self.db.add(reservation)
        await self.db.flush()
        return reservation

    async def reconcile_usage(
        self,
        reservation: BudgetReservationModel,
        used_amount: int,
    ) -> None:
        """Commit actual resource usage and release excess reservation."""
        reservation.used_amount = min(used_amount, reservation.reserved_amount)
        reservation.status = "committed"
        await self.db.flush()

    async def release_reservation(self, reservation: BudgetReservationModel) -> None:
        """Release reservation if task failed or was cancelled."""
        reservation.status = "released"
        await self.db.flush()

    async def get_budget_summary(self, investigation: InvestigationModel) -> InvestigationBudgets:
        """Aggregate used queries, fetches, and cost into InvestigationBudgets domain model."""
        stmt = (
            select(
                BudgetReservationModel.resource_type,
                func.coalesce(func.sum(BudgetReservationModel.used_amount), 0),
            )
            .where(
                BudgetReservationModel.investigation_id == investigation.id,
                BudgetReservationModel.status == "committed",
            )
            .group_by(BudgetReservationModel.resource_type)
        )
        result = await self.db.execute(stmt)
        usage_by_type = dict(result.fetchall())

        budget_cfg = investigation.budget_config or {}
        max_queries = budget_cfg.get("max_queries", 50)
        max_fetches = budget_cfg.get("max_fetches", 50)
        cost_ceiling_usd = budget_cfg.get("cost_ceiling_usd", 10.0)
        deadline_seconds = budget_cfg.get("deadline_seconds", 900)

        used_queries = usage_by_type.get("queries", 0)
        used_fetches = usage_by_type.get("fetches", 0)
        used_cost_cents = usage_by_type.get("cost_cents", 0)
        used_cost_usd = round(used_cost_cents / 100.0, 4)

        return InvestigationBudgets(
            max_queries=max_queries,
            used_queries=used_queries,
            max_fetches=max_fetches,
            used_fetches=used_fetches,
            cost_ceiling_usd=cost_ceiling_usd,
            used_cost_usd=used_cost_usd,
            deadline_seconds=deadline_seconds,
        )
