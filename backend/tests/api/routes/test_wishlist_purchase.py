"""Tests for the wishlist purchase endpoint."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.features.budget.models import Budget
from app.features.budget.service import get_or_create_budget
from app.features.users.models import User
from app.features.users.service import get_user_by_email
from app.features.wishlist_item.models import WishlistItem, WishlistItemCreate
from app.features.wishlist_item.service import create_wishlist_item


def create_wishlist_item_for_user(
    db: Session, user: User, price_cents: int = 1000
) -> WishlistItem:
    """Create a wishlist item owned by the given user."""
    item_in = WishlistItemCreate(
        title="Test Item",
        description="A test wishlist item",
        price_cents=price_cents,
    )
    return create_wishlist_item(session=db, item_create=item_in, owner_id=user.id)


def set_user_budget(db: Session, user: User, cents: int) -> Budget:
    """Set a user's budget to a specific amount."""
    budget = get_or_create_budget(db, user.id)
    budget.cents_at_last_update = cents
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


def test_purchase_item_success(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    """Test successfully purchasing a wishlist item."""
    # Get the superuser
    user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
    assert user is not None

    # Set up budget with enough money
    set_user_budget(db, user, 10000)  # $100

    # Create a wishlist item
    item = create_wishlist_item_for_user(db, user, price_cents=2500)  # $25

    # Purchase the item
    response = client.post(
        f"{settings.API_V1_STR}/wishlist/{item.id}/purchase",
        headers=superuser_token_headers,
    )

    assert response.status_code == 200
    content = response.json()
    assert content["id"] == str(item.id)
    assert content["status"] == "purchased"
    assert "purchased_at" in content

    # Verify budget was deducted
    db.refresh(user)
    budget = get_or_create_budget(db, user.id)
    assert budget.cents_at_last_update == 7500  # $100 - $25 = $75


def test_purchase_item_allows_negative_balance(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    """Test purchasing an item when budget is insufficient results in negative balance."""
    user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
    assert user is not None

    # Set up budget with less than item price
    set_user_budget(db, user, 1000)  # $10

    # Create an expensive item
    item = create_wishlist_item_for_user(db, user, price_cents=5000)  # $50

    response = client.post(
        f"{settings.API_V1_STR}/wishlist/{item.id}/purchase",
        headers=superuser_token_headers,
    )

    # Purchase succeeds even with insufficient funds
    assert response.status_code == 200
    content = response.json()
    assert content["status"] == "purchased"

    # Budget goes negative: $10 - $50 = -$40
    db.refresh(user)
    budget = get_or_create_budget(db, user.id)
    assert budget.cents_at_last_update == -4000


def test_purchase_item_already_purchased(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    """Test that purchasing an already purchased item fails."""
    user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
    assert user is not None

    set_user_budget(db, user, 10000)
    item = create_wishlist_item_for_user(db, user, price_cents=1000)

    # Purchase once
    response = client.post(
        f"{settings.API_V1_STR}/wishlist/{item.id}/purchase",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200

    # Try to purchase again
    response = client.post(
        f"{settings.API_V1_STR}/wishlist/{item.id}/purchase",
        headers=superuser_token_headers,
    )
    assert response.status_code == 400
    content = response.json()
    assert content["detail"] == "Item is already purchased"


def test_purchase_item_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    """Test purchasing a non-existent item."""
    response = client.post(
        f"{settings.API_V1_STR}/wishlist/{uuid.uuid4()}/purchase",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404
    content = response.json()
    assert content["detail"] == "Item not found"


def test_purchase_item_not_owner(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    """Test that users cannot purchase items they don't own."""
    # Create item for superuser
    superuser = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
    assert superuser is not None
    item = create_wishlist_item_for_user(db, superuser, price_cents=1000)

    # Try to purchase as normal user
    response = client.post(
        f"{settings.API_V1_STR}/wishlist/{item.id}/purchase",
        headers=normal_user_token_headers,
    )
    assert response.status_code == 403
    content = response.json()
    assert content["detail"] == "Not enough permissions"


# Undo Purchase Tests


def test_undo_purchase_success(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    """Test successfully undoing a purchase - item returns to wishlisted, budget refunded."""
    user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
    assert user is not None

    # Set up budget and create item
    set_user_budget(db, user, 10000)  # $100
    item = create_wishlist_item_for_user(db, user, price_cents=2500)  # $25

    # Purchase the item first
    response = client.post(
        f"{settings.API_V1_STR}/wishlist/{item.id}/purchase",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "purchased"

    # Verify budget was deducted
    budget = get_or_create_budget(db, user.id)
    assert budget.cents_at_last_update == 7500  # $100 - $25 = $75

    # Undo the purchase
    response = client.post(
        f"{settings.API_V1_STR}/wishlist/{item.id}/undo",
        headers=superuser_token_headers,
        json={
            "reason": "Changed my mind about this Greendale hoodie",
            "destination": "wishlist",
        },
    )

    assert response.status_code == 200
    content = response.json()
    assert content["id"] == str(item.id)
    assert content["status"] == "wishlisted"
    assert "purchased_at" not in content or content.get("purchased_at") is None

    # Verify budget was refunded
    db.refresh(budget)
    assert budget.cents_at_last_update == 10000  # $75 + $25 = $100


def test_undo_purchase_non_purchased_item_returns_400(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    """Test that undoing a non-purchased item returns 400 ValidationError."""
    user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
    assert user is not None

    set_user_budget(db, user, 10000)
    item = create_wishlist_item_for_user(db, user, price_cents=1000)

    # Try to undo purchase on an item that was never purchased
    response = client.post(
        f"{settings.API_V1_STR}/wishlist/{item.id}/undo",
        headers=superuser_token_headers,
        json={"reason": "Troy and Abed in the morning!", "destination": "wishlist"},
    )

    assert response.status_code == 400
    content = response.json()
    assert content["detail"] == "Item must be purchased or gifted to undo"


def test_undo_purchase_records_reason(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    """Test that undo purchase records the reason in the item."""
    user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
    assert user is not None

    set_user_budget(db, user, 10000)
    item = create_wishlist_item_for_user(db, user, price_cents=1500)

    # Purchase the item
    response = client.post(
        f"{settings.API_V1_STR}/wishlist/{item.id}/purchase",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200

    # Undo with a specific reason
    undo_reason = "Dean Pelton returned it in his matching outfit"
    response = client.post(
        f"{settings.API_V1_STR}/wishlist/{item.id}/undo",
        headers=superuser_token_headers,
        json={"reason": undo_reason, "destination": "wishlist"},
    )

    assert response.status_code == 200

    # Verify reason was recorded by checking the DB directly
    db.refresh(item)
    assert item.undo_reason == undo_reason


def test_undo_purchase_item_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    """Test undoing purchase of a non-existent item."""
    response = client.post(
        f"{settings.API_V1_STR}/wishlist/{uuid.uuid4()}/undo",
        headers=superuser_token_headers,
        json={"reason": "Streets ahead of this item", "destination": "wishlist"},
    )
    assert response.status_code == 404
    content = response.json()
    assert content["detail"] == "Item not found"


def test_undo_purchase_not_owner(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    """Test that users cannot undo purchases on items they don't own."""
    # Create and purchase item for superuser
    superuser = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
    assert superuser is not None
    set_user_budget(db, superuser, 10000)
    item = create_wishlist_item_for_user(db, superuser, price_cents=1000)

    # Purchase as superuser (need to use the API for this)
    from app.features.wishlist_item.service import mark_as_purchased

    mark_as_purchased(db, item)

    # Try to undo as normal user
    response = client.post(
        f"{settings.API_V1_STR}/wishlist/{item.id}/undo",
        headers=normal_user_token_headers,
        json={"reason": "Pop pop!", "destination": "wishlist"},
    )
    assert response.status_code == 403
    content = response.json()
    assert content["detail"] == "Not enough permissions"
