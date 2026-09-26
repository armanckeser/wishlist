"""Tests for prepopulate CLI command."""

import asyncio
from pathlib import Path
from tempfile import NamedTemporaryFile
from unittest.mock import AsyncMock, patch

from sqlmodel import Session

from app.commands.prepopulate import prepopulate_async, setup_test_user
from app.features.url_parser.models import ProductMetadata
from app.features.users.models import UserCreate
from app.features.users.service import create_user, get_user_by_email
from app.features.wishlist_item.models import WishlistItemCreate
from app.features.wishlist_item.service import (
    create_wishlist_item,
    get_wishlist_items_for_user,
)


def _run_async(coro):  # noqa: ANN001, ANN202
    """Helper to run async code in sync test."""
    return asyncio.run(coro)


def test_prepopulate_with_invalid_user(session: Session) -> None:
    """Test that prepopulate fails gracefully with non-existent user."""
    exit_code = _run_async(
        prepopulate_async(
            user_email="nonexistent@example.com",
            limit=1,
            timeout=30.0,
            csv_path=Path("backend/data/product_urls.csv"),
            verbose=False,
            session=session,
        )
    )

    assert exit_code == 1, "Should return exit code 1 for non-existent user"


def test_prepopulate_skips_when_user_has_items(session: Session) -> None:
    """Test that prepopulate skips import when user already has items."""
    # Create a test user
    user_in = UserCreate(
        email="troy.barnes@greendale.edu",
        password="sixseasonsandamovie",
    )
    user = create_user(session=session, user_create=user_in)

    # Create one wishlist item for the user
    item_create = WishlistItemCreate(
        title="Test Item",
        price_cents=1000,
    )
    create_wishlist_item(session, item_create, user.id)

    # Run prepopulate
    exit_code = _run_async(
        prepopulate_async(
            user_email=user.email,
            limit=1,
            timeout=30.0,
            csv_path=Path("backend/data/product_urls.csv"),
            verbose=False,
            session=session,
        )
    )

    # Should succeed (exit code 0) but skip import
    assert exit_code == 0, "Should succeed but skip import"

    # Verify no additional items were created
    items, _ = get_wishlist_items_for_user(session, user.id)
    assert len(items) == 1, "Should still have only 1 item"


def test_prepopulate_with_missing_csv(session: Session) -> None:
    """Test that prepopulate fails gracefully when CSV file is missing."""
    # Create a test user
    user_in = UserCreate(
        email="annie.edison@greendale.edu",
        password="sixseasonsandamovie",
    )
    user = create_user(session=session, user_create=user_in)

    # Run prepopulate with non-existent CSV path
    exit_code = _run_async(
        prepopulate_async(
            user_email=user.email,
            limit=1,
            timeout=30.0,
            csv_path=Path("/nonexistent/path/to/urls.csv"),
            verbose=False,
            session=session,
        )
    )

    assert exit_code == 1, "Should return exit code 1 for missing CSV"


def test_prepopulate_with_empty_csv(session: Session) -> None:
    """Test that prepopulate handles empty CSV gracefully."""
    # Create a test user
    user_in = UserCreate(
        email="britta.perry@greendale.edu",
        password="sixseasonsandamovie",
    )
    user = create_user(session=session, user_create=user_in)

    # Create a temporary empty CSV file
    with NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
        csv_path = Path(f.name)

    try:
        # Run prepopulate with empty CSV
        exit_code = _run_async(
            prepopulate_async(
                user_email=user.email,
                limit=10,
                timeout=30.0,
                csv_path=csv_path,
                verbose=False,
                session=session,
            )
        )

        # Should succeed but create 0 items
        assert exit_code == 0, "Should succeed with empty CSV"

        # Verify test user was created
        test_user = get_user_by_email(session, "abed.nadir@greendale.edu")
        assert test_user is not None, "Test user should be created"

        # Verify no items were created for main user (test user has 3 items)
        items, _ = get_wishlist_items_for_user(session, user.id)
        assert len(items) == 0, "Should have 0 items from empty CSV"

    finally:
        # Clean up temp file
        csv_path.unlink()


def test_setup_test_user_creates_new_user(session: Session) -> None:
    """Test that setup_test_user creates test user and items."""
    # Create a main user
    user_in = UserCreate(
        email="jeff.winger@greendale.edu",
        password="sixseasonsandamovie",
    )
    main_user = create_user(session=session, user_create=user_in)

    # Call setup_test_user
    was_created = _run_async(setup_test_user(session, main_user))

    assert was_created is True, "Should indicate test user was created"

    # Verify test user exists
    test_user = get_user_by_email(session, "abed.nadir@greendale.edu")
    assert test_user is not None, "Test user should exist"
    assert test_user.full_name == "Abed Nadir", "Test user should have correct name"

    # Verify test user has 3 wishlist items
    items, _ = get_wishlist_items_for_user(session, test_user.id)
    assert len(items) == 3, "Test user should have 3 wishlist items"


def test_setup_test_user_reuses_existing_user(session: Session) -> None:
    """Test that setup_test_user reuses existing test user."""
    # Create main user
    user_in = UserCreate(
        email="pierce.hawthorne@greendale.edu",
        password="sixseasonsandamovie",
    )
    main_user = create_user(session=session, user_create=user_in)

    # Create test user first
    test_user_in = UserCreate(
        email="abed.nadir@greendale.edu",
        password="existingpassword",
    )
    existing_test_user = create_user(session=session, user_create=test_user_in)

    # Call setup_test_user
    was_created = _run_async(setup_test_user(session, main_user))

    assert was_created is False, "Should indicate test user already existed"

    # Verify test user still exists and wasn't recreated
    test_user = get_user_by_email(session, "abed.nadir@greendale.edu")
    assert test_user is not None, "Test user should exist"
    assert test_user.id == existing_test_user.id, "Should be the same user"


@patch("app.commands.prepopulate.parse_url")
def test_prepopulate_with_force_appends_items(
    mock_parse_url: AsyncMock, session: Session
) -> None:
    """Test that prepopulate with --force appends new items to existing ones."""
    # Create a test user
    user_in = UserCreate(
        email="shirley.bennett@greendale.edu",
        password="sixseasonsandamovie",
    )
    user = create_user(session=session, user_create=user_in)

    # Create an existing wishlist item
    existing_item = WishlistItemCreate(
        title="Existing Item",
        price_cents=2000,
    )
    create_wishlist_item(session, existing_item, user.id)

    # Verify user has 1 item
    items_before, _ = get_wishlist_items_for_user(session, user.id)
    assert len(items_before) == 1, "Should have 1 existing item"

    # Mock parse_url to return a Community-themed product
    mock_parse_url.return_value = (
        ProductMetadata(
            title="Inspector Spacetime Action Figure",
            description="Collectible figure from the classic British show",
            price_cents=3999,
            image_url="https://example.com/spacetime.jpg",
            source_url="https://example.com/product",
        ),
        "httpx",
    )

    # Create a temporary CSV with one URL
    with NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
        f.write("https://example.com/product\n")
        csv_path = Path(f.name)

    try:
        # Run prepopulate with force=True
        exit_code = _run_async(
            prepopulate_async(
                user_email=user.email,
                limit=10,
                timeout=30.0,
                csv_path=csv_path,
                verbose=False,
                force=True,
                session=session,
            )
        )

        # Should succeed
        assert exit_code == 0, "Should succeed with force flag"

        # Verify new item was added (total = 2)
        items_after, _ = get_wishlist_items_for_user(session, user.id)
        assert len(items_after) == 2, "Should have 2 items (1 existing + 1 new)"

        # Verify existing item is still there
        existing_titles = {item.title for item in items_after}
        assert "Existing Item" in existing_titles, "Existing item should be preserved"
        assert (
            "Inspector Spacetime Action Figure" in existing_titles
        ), "New item should be added"

    finally:
        # Clean up temp file
        csv_path.unlink()
