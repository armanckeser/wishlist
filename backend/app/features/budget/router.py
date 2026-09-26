"""Budget routes for viewing and managing user budget."""

from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep
from app.features.budget.models import BudgetPublic, BudgetUpdate
from app.features.budget.service import (
    flush_and_update_budget,
    get_or_create_budget,
    manual_unfreeze,
)

router = APIRouter(prefix="/budget", tags=["budget"])


@router.get("/")
def get_budget(session: SessionDep, current_user: CurrentUser) -> BudgetPublic:
    """Get the current user's budget with calculated current amount."""
    return get_or_create_budget(session, current_user.id)  # type: ignore[return-value]


@router.patch("/")
def update_budget(
    session: SessionDep,
    current_user: CurrentUser,
    budget_update: BudgetUpdate,
) -> BudgetPublic:
    """Update the current user's budget.

    Flushes accrued value before applying changes to prevent losing
    accumulated budget when changing rate or amount.
    """
    budget = get_or_create_budget(session, current_user.id)
    return flush_and_update_budget(session, budget, budget_update)  # type: ignore[return-value]


@router.post("/unfreeze")
def unfreeze_budget(
    session: SessionDep,
    current_user: CurrentUser,
) -> BudgetPublic:
    """Manually unfreeze the budget.

    Restores the original accrual rate and clears the freeze.
    Accrual resumes from the moment of unfreezing (no retroactive accrual).
    """
    budget = get_or_create_budget(session, current_user.id)
    return manual_unfreeze(session, budget)  # type: ignore[return-value]
