from pathlib import Path
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import CurrentUser, SessionDep
from app.core.security import get_password_hash
from app.features.budget.service import get_or_create_budget
from app.features.category.service import (
    create_default_categories_for_user,
    get_categories_for_user,
)
from app.features.url_parser.service import parse_url
from app.features.users.models import User, UserPublic
from app.features.users.service import get_user_by_email
from app.features.wishlist_item.models import WishlistItemCreate
from app.features.wishlist_item.service import (
    create_wishlist_item,
    get_wishlist_items_for_user,
)
from app.features.wishlist_share.service import create_share, get_shares_with_user

router = APIRouter(tags=["private"], prefix="/private")

DATA_DIR = Path(__file__).parent.parent.parent.parent / "data"


class PrivateUserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    is_verified: bool = False


@router.post("/users/", response_model=UserPublic)
def create_user(user_in: PrivateUserCreate, session: SessionDep) -> Any:
    """
    Create a new user.
    """

    user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=get_password_hash(user_in.password),
    )

    session.add(user)
    session.commit()

    return user


class PrepopulateResponse(BaseModel):
    items_created: int
    categories_created: int
    budget_set: bool
    test_user_created: bool
    test_user_id: str | None
    errors: list[str]


@router.post("/prepopulate", response_model=PrepopulateResponse, deprecated=True)
async def prepopulate_test_data(
    session: SessionDep,
    current_user: CurrentUser,
) -> PrepopulateResponse:
    """
    Prepopulate the wishlist with test products from product_urls.csv.
    Sets up budget and default categories.

    **DEPRECATED**: Use the CLI command `uv run wishlist-cli prepopulate run` instead.
    This endpoint will be removed in a future version.
    """
    errors: list[str] = []
    items_created = 0
    categories_created = 0
    test_user_created = False
    test_user_id: str | None = None

    # Set up budget ($500 at $600/mo)
    budget = get_or_create_budget(session, current_user.id)
    budget.cents_at_last_update = 50000  # $500
    budget.monthly_rate_cents = 60000  # $600/mo
    session.add(budget)
    session.commit()

    # Create default categories if none exist
    existing_categories = get_categories_for_user(session, current_user.id)
    if not existing_categories:
        new_categories = create_default_categories_for_user(session, current_user.id)
        categories_created = len(new_categories)

    # Skip if user already has items
    existing_items, _ = get_wishlist_items_for_user(session, current_user.id)
    if existing_items:
        return PrepopulateResponse(
            items_created=0,
            categories_created=categories_created,
            budget_set=True,
            test_user_created=test_user_created,
            test_user_id=test_user_id,
            errors=["User already has wishlist items, skipping product import"],
        )

    # Create a test user to share their wishlist with current user
    test_email = "abed.nadir@greendale.edu"

    existing_test_user = get_user_by_email(session, test_email)
    if not existing_test_user:
        test_user = User(
            email=test_email,
            full_name="Abed Nadir",
            hashed_password=get_password_hash("sixseasonsandamovie"),
        )
        session.add(test_user)
        session.commit()
        session.refresh(test_user)
        test_user_created = True
        test_user_id = str(test_user.id)

        # Create some wishlist items for the test user
        test_items = [
            WishlistItemCreate(
                title="Inspector Spacetime DVD Box Set",
                price_cents=4999,
                description="Complete series collection",
            ),
            WishlistItemCreate(
                title="Dreamatorium Equipment",
                price_cents=29999,
                description="For imagination adventures",
            ),
            WishlistItemCreate(
                title="Film Camera",
                price_cents=89999,
                description="For making documentaries about everything",
            ),
        ]
        for item_create in test_items:
            create_wishlist_item(session, item_create, test_user.id)

        # Share test user's wishlist with current user
        create_share(session, test_user.id, current_user.email)
    else:
        test_user_id = str(existing_test_user.id)
        # Ensure share exists
        existing_shares = get_shares_with_user(session, current_user.id)
        has_share = any(s.owner_id == existing_test_user.id for s in existing_shares)
        if not has_share:
            create_share(session, existing_test_user.id, current_user.email)

    # Read URLs from CSV
    csv_path = DATA_DIR / "product_urls.csv"
    if not csv_path.exists():
        return PrepopulateResponse(
            items_created=0,
            categories_created=categories_created,
            budget_set=True,
            test_user_created=test_user_created,
            test_user_id=test_user_id,
            errors=["product_urls.csv not found"],
        )

    with open(csv_path, encoding="utf-8") as file:
        urls = [line.strip() for line in file if line.strip()]

    # Parse first 10 URLs and create items
    for url in urls[:10]:
        try:
            metadata, _ = await parse_url(url, timeout=30.0)
            if not metadata.title:
                errors.append(f"No title found for {url[:50]}...")
                continue

            item_create = WishlistItemCreate(
                title=metadata.title,
                description=metadata.description,
                price_cents=metadata.price_cents or 0,
                image_url=metadata.image_url,
                product_url=metadata.source_url,
            )
            create_wishlist_item(session, item_create, current_user.id)
            items_created += 1
        except Exception as e:
            errors.append(f"Failed to parse {url[:50]}...: {e!s}")

    return PrepopulateResponse(
        items_created=items_created,
        categories_created=categories_created,
        budget_set=True,
        test_user_created=test_user_created,
        test_user_id=test_user_id,
        errors=errors,
    )
