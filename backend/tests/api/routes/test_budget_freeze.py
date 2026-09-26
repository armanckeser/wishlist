"""Tests for budget freeze and cool-off behavior.

Theme: Community's study group faces unexpected budget freezes
like Jeff faces the unexpected consequences of his schemes.
"""

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.features.budget.models import Budget
from app.features.budget.service import (
    apply_freeze,
    calculate_required_cooloff_days,
    check_and_unfreeze,
    get_or_create_budget,
    is_budget_frozen,
    is_purchase_impulsive,
)
from app.features.users.models import User, UserCreate
from app.features.users.service import create_user, get_user_by_email
from app.features.wishlist_item.models import WishlistItem, WishlistItemCreate
from app.features.wishlist_item.service import create_wishlist_item


def get_test_user(db: Session) -> User:
    """Get or create the test superuser (Jeff Winger of budget management)."""
    user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
    if user:
        return user
    user_in = UserCreate(
        email=settings.FIRST_SUPERUSER,
        password=settings.FIRST_SUPERUSER_PASSWORD,
        is_superuser=True,
    )
    return create_user(session=db, user_create=user_in)


def reset_budget(db: Session, user: User) -> Budget:
    """Reset budget to clean state for testing."""
    budget = get_or_create_budget(db, user.id)
    budget.cents_at_last_update = 10000  # $100
    budget.monthly_rate_cents = 60000  # $600/month
    budget.stashed_monthly_rate_cents = None
    budget.freeze_until = None
    budget.cooloff_base_days = 0
    budget.cooloff_scaling_cents = None
    budget.cooloff_scaling_days = 3
    budget.cooloff_min_threshold_cents = None
    budget.cooloff_min_threshold_days = 7
    budget.freeze_penalty_days = 7
    budget.last_updated_at = datetime.now(timezone.utc)
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


def create_test_item(
    db: Session, user: User, price_cents: int = 5000, added_at: datetime | None = None
) -> WishlistItem:
    """Create a wishlist item for testing."""
    item_in = WishlistItemCreate(
        title="Streets Ahead Item",
        description="If you have to ask, you're streets behind",
        price_cents=price_cents,
    )
    item = create_wishlist_item(session=db, item_create=item_in, owner_id=user.id)
    if added_at:
        item.added_at = added_at
        db.add(item)
        db.commit()
        db.refresh(item)
    return item


# =============================================================================
# Freeze Mechanism Tests - "The darkest timeline" of budgets
# =============================================================================


class TestBudgetFreezeBasics:
    """Test basic freeze/unfreeze mechanics."""

    def test_is_budget_frozen_when_stashed_rate_exists(self, db: Session) -> None:
        """Budget is frozen when stashed_monthly_rate_cents is set."""
        user = get_test_user(db)
        budget = reset_budget(db, user)

        assert not is_budget_frozen(budget)

        budget.stashed_monthly_rate_cents = 60000
        assert is_budget_frozen(budget)

    def test_apply_freeze_sets_rate_to_zero(self, db: Session) -> None:
        """Applying freeze should set rate to 0 and stash original."""
        user = get_test_user(db)
        budget = reset_budget(db, user)

        original_rate = budget.monthly_rate_cents

        apply_freeze(db, budget, freeze_days=7)

        assert budget.monthly_rate_cents == 0
        assert budget.stashed_monthly_rate_cents == original_rate
        assert budget.freeze_until is not None

    def test_apply_freeze_flushes_accrued_value(self, db: Session) -> None:
        """Freeze should flush any accrued value before freezing."""
        user = get_test_user(db)
        budget = reset_budget(db, user)

        # Set last_updated_at to an hour ago to accrue some value
        budget.last_updated_at = datetime.now(timezone.utc) - timedelta(hours=1)
        db.add(budget)
        db.commit()
        db.refresh(budget)

        original_stored = budget.cents_at_last_update

        apply_freeze(db, budget, freeze_days=7)

        # Should have accrued ~82 cents ($600/month * 1 hour)
        assert budget.cents_at_last_update > original_stored

    def test_freeze_extends_when_already_frozen(self, db: Session) -> None:
        """If already frozen, extend to the later end date."""
        user = get_test_user(db)
        budget = reset_budget(db, user)

        # First freeze for 7 days
        apply_freeze(db, budget, freeze_days=7)
        first_freeze_until = budget.freeze_until
        original_stash = budget.stashed_monthly_rate_cents

        # Second freeze for 3 days (should keep the longer 7 day freeze)
        apply_freeze(db, budget, freeze_days=3)

        assert budget.freeze_until == first_freeze_until
        assert budget.stashed_monthly_rate_cents == original_stash

    def test_freeze_extends_when_new_freeze_is_longer(self, db: Session) -> None:
        """If new freeze is longer, extend to the new date."""
        user = get_test_user(db)
        budget = reset_budget(db, user)

        # First freeze for 3 days
        apply_freeze(db, budget, freeze_days=3)
        first_freeze_until = budget.freeze_until

        # Second freeze for 10 days (should extend)
        apply_freeze(db, budget, freeze_days=10)

        assert budget.freeze_until is not None
        assert first_freeze_until is not None
        assert budget.freeze_until > first_freeze_until


class TestBudgetUnfreeze:
    """Test lazy unfreeze behavior - when the study group thaws out."""

    def test_check_and_unfreeze_does_nothing_when_not_frozen(self, db: Session) -> None:
        """Non-frozen budget should pass through unchanged."""
        user = get_test_user(db)
        budget = reset_budget(db, user)

        result = check_and_unfreeze(db, budget)

        assert result.monthly_rate_cents == 60000
        assert result.stashed_monthly_rate_cents is None

    def test_check_and_unfreeze_does_nothing_when_still_frozen(
        self, db: Session
    ) -> None:
        """Budget with future freeze_until should stay frozen."""
        user = get_test_user(db)
        budget = reset_budget(db, user)

        apply_freeze(db, budget, freeze_days=7)

        result = check_and_unfreeze(db, budget)

        assert is_budget_frozen(result)
        assert result.monthly_rate_cents == 0

    def test_check_and_unfreeze_restores_rate_when_expired(self, db: Session) -> None:
        """Expired freeze should restore original rate."""
        user = get_test_user(db)
        budget = reset_budget(db, user)

        original_rate = budget.monthly_rate_cents

        apply_freeze(db, budget, freeze_days=7)

        # Manually set freeze_until to the past
        budget.freeze_until = datetime.now(timezone.utc) - timedelta(hours=1)
        db.add(budget)
        db.commit()
        db.refresh(budget)

        result = check_and_unfreeze(db, budget)

        assert result.monthly_rate_cents == original_rate
        assert result.stashed_monthly_rate_cents is None
        assert result.freeze_until is None

    def test_unfreeze_sets_last_updated_to_freeze_end(self, db: Session) -> None:
        """Accrual should resume from freeze end time, not unfreeze time."""
        user = get_test_user(db)
        budget = reset_budget(db, user)

        apply_freeze(db, budget, freeze_days=7)

        # Set freeze to have ended 1 hour ago
        freeze_end = datetime.now(timezone.utc) - timedelta(hours=1)
        budget.freeze_until = freeze_end
        db.add(budget)
        db.commit()
        db.refresh(budget)

        result = check_and_unfreeze(db, budget)

        # last_updated_at should be the freeze end time, allowing accrual for that hour
        # Compare without timezone since SQLite doesn't preserve tz info
        result_time = result.last_updated_at.replace(tzinfo=None)
        expected_time = freeze_end.replace(tzinfo=None)
        assert result_time == expected_time

    def test_get_or_create_budget_triggers_unfreeze(self, db: Session) -> None:
        """Lazy unfreeze should happen on get_or_create_budget."""
        user = get_test_user(db)
        budget = reset_budget(db, user)

        original_rate = budget.monthly_rate_cents

        apply_freeze(db, budget, freeze_days=7)

        # Manually expire the freeze
        budget.freeze_until = datetime.now(timezone.utc) - timedelta(hours=1)
        db.add(budget)
        db.commit()

        # Get budget should trigger unfreeze
        result = get_or_create_budget(db, user.id)

        assert result.monthly_rate_cents == original_rate
        assert not is_budget_frozen(result)


# =============================================================================
# Cool-off Calculation Tests - "Patience is a virtue, unlike Pierce"
# =============================================================================


class TestCooloffCalculation:
    """Test cool-off period calculations."""

    def test_cooloff_base_days_only(self, db: Session) -> None:
        """Base cool-off applies to all items."""
        user = get_test_user(db)
        budget = reset_budget(db, user)
        budget.cooloff_base_days = 3
        db.add(budget)
        db.commit()

        result = calculate_required_cooloff_days(budget, price_cents=100)  # $1

        assert result == 3

    def test_cooloff_scaling_basic(self, db: Session) -> None:
        """Price-based scaling: for every $100, add 3 days."""
        user = get_test_user(db)
        budget = reset_budget(db, user)
        budget.cooloff_scaling_cents = 10000  # $100
        budget.cooloff_scaling_days = 3
        db.add(budget)
        db.commit()

        # $300 item should need 9 days
        result = calculate_required_cooloff_days(budget, price_cents=30000)

        assert result == 9

    def test_cooloff_scaling_partial(self, db: Session) -> None:
        """Partial price units should round down."""
        user = get_test_user(db)
        budget = reset_budget(db, user)
        budget.cooloff_scaling_cents = 10000  # $100
        budget.cooloff_scaling_days = 3
        db.add(budget)
        db.commit()

        # $150 item: 1.5 units * 3 days = 4.5, should floor to 4
        result = calculate_required_cooloff_days(budget, price_cents=15000)

        assert result == 4

    def test_cooloff_threshold_applies_when_exceeded(self, db: Session) -> None:
        """Items over threshold get minimum threshold days."""
        user = get_test_user(db)
        budget = reset_budget(db, user)
        budget.cooloff_min_threshold_cents = 20000  # $200
        budget.cooloff_min_threshold_days = 7
        db.add(budget)
        db.commit()

        # $250 item should need at least 7 days
        result = calculate_required_cooloff_days(budget, price_cents=25000)

        assert result == 7

    def test_cooloff_threshold_not_applied_when_under(self, db: Session) -> None:
        """Items under threshold don't get threshold days."""
        user = get_test_user(db)
        budget = reset_budget(db, user)
        budget.cooloff_min_threshold_cents = 20000  # $200
        budget.cooloff_min_threshold_days = 7
        db.add(budget)
        db.commit()

        # $100 item under threshold
        result = calculate_required_cooloff_days(budget, price_cents=10000)

        assert result == 0

    def test_cooloff_takes_max_of_all_rules(self, db: Session) -> None:
        """Cool-off should be the maximum of all applicable rules."""
        user = get_test_user(db)
        budget = reset_budget(db, user)
        budget.cooloff_base_days = 2
        budget.cooloff_scaling_cents = 10000  # $100
        budget.cooloff_scaling_days = 3
        budget.cooloff_min_threshold_cents = 50000  # $500
        budget.cooloff_min_threshold_days = 10
        db.add(budget)
        db.commit()

        # $600 item:
        # - Base: 2 days
        # - Scaling: 6 * 3 = 18 days
        # - Threshold: 10 days (exceeds $500)
        # Max should be 18
        result = calculate_required_cooloff_days(budget, price_cents=60000)

        assert result == 18


class TestImpulsivePurchaseDetection:
    """Test impulsive purchase detection - like Troy buying action figures."""

    def test_not_impulsive_when_no_cooloff_configured(self, db: Session) -> None:
        """No cool-off settings means no impulsive purchases."""
        user = get_test_user(db)
        budget = reset_budget(db, user)

        now = datetime.now(timezone.utc)
        added_just_now = now - timedelta(minutes=1)

        result = is_purchase_impulsive(budget, added_just_now, item_price_cents=10000)

        assert result is False

    def test_impulsive_when_under_cooloff(self, db: Session) -> None:
        """Purchase before cool-off ends is impulsive."""
        user = get_test_user(db)
        budget = reset_budget(db, user)
        budget.cooloff_base_days = 7
        db.add(budget)
        db.commit()

        now = datetime.now(timezone.utc)
        added_3_days_ago = now - timedelta(days=3)

        result = is_purchase_impulsive(budget, added_3_days_ago, item_price_cents=10000)

        assert result is True

    def test_not_impulsive_when_cooloff_satisfied(self, db: Session) -> None:
        """Purchase after cool-off ends is not impulsive."""
        user = get_test_user(db)
        budget = reset_budget(db, user)
        budget.cooloff_base_days = 7
        db.add(budget)
        db.commit()

        now = datetime.now(timezone.utc)
        added_10_days_ago = now - timedelta(days=10)

        result = is_purchase_impulsive(
            budget, added_10_days_ago, item_price_cents=10000
        )

        assert result is False


# =============================================================================
# Integration Tests - "The whole study group comes together"
# =============================================================================


class TestPurchaseWithFreeze:
    """Test the full purchase flow with freeze penalties."""

    def test_impulsive_purchase_triggers_freeze(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Buying before cool-off ends should freeze the budget."""
        user = get_test_user(db)
        budget = reset_budget(db, user)
        budget.cooloff_base_days = 7  # 7 day cool-off for all items
        budget.freeze_penalty_days = 5  # 5 day freeze penalty
        db.add(budget)
        db.commit()

        # Create item added just now (violates 7 day cool-off)
        item = create_test_item(db, user, price_cents=5000)

        # Purchase the item
        response = client.post(
            f"{settings.API_V1_STR}/wishlist/{item.id}/purchase",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200

        # Budget should now be frozen
        db.refresh(budget)
        assert is_budget_frozen(budget)
        assert budget.monthly_rate_cents == 0
        assert budget.stashed_monthly_rate_cents == 60000

    def test_patient_purchase_no_freeze(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Buying after cool-off ends should NOT freeze the budget."""
        user = get_test_user(db)
        budget = reset_budget(db, user)
        budget.cooloff_base_days = 7
        budget.freeze_penalty_days = 5
        db.add(budget)
        db.commit()

        # Create item added 10 days ago (satisfies 7 day cool-off)
        item = create_test_item(
            db,
            user,
            price_cents=5000,
            added_at=datetime.now(timezone.utc) - timedelta(days=10),
        )

        # Purchase the item
        response = client.post(
            f"{settings.API_V1_STR}/wishlist/{item.id}/purchase",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200

        # Budget should NOT be frozen
        db.refresh(budget)
        assert not is_budget_frozen(budget)
        assert budget.monthly_rate_cents == 60000

    def test_frozen_budget_shows_in_api_response(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """API should return freeze status in budget response."""
        user = get_test_user(db)
        budget = reset_budget(db, user)

        apply_freeze(db, budget, freeze_days=7)

        response = client.get(
            f"{settings.API_V1_STR}/budget/",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        content = response.json()
        assert content["monthly_rate_cents"] == 0
        assert content["stashed_monthly_rate_cents"] == 60000
        assert content["freeze_until"] is not None


class TestCooloffMaxDays:
    """Test maximum cooloff cap - like Jeff capping his enthusiasm."""

    def test_max_days_caps_scaling(self, db: Session) -> None:
        """Max days should cap the scaling calculation."""
        user = get_test_user(db)
        budget = reset_budget(db, user)
        budget.cooloff_scaling_cents = 10000  # $100
        budget.cooloff_scaling_days = 3
        budget.cooloff_max_days = 10  # Cap at 10 days
        db.add(budget)
        db.commit()

        # $500 item would need 15 days from scaling, but max is 10
        result = calculate_required_cooloff_days(budget, price_cents=50000)

        assert result == 10

    def test_max_days_caps_threshold(self, db: Session) -> None:
        """Max days should also cap threshold minimum."""
        user = get_test_user(db)
        budget = reset_budget(db, user)
        budget.cooloff_min_threshold_cents = 10000  # $100
        budget.cooloff_min_threshold_days = 14
        budget.cooloff_max_days = 7  # Cap at 7 days
        db.add(budget)
        db.commit()

        # $200 item hits threshold for 14 days, but max is 7
        result = calculate_required_cooloff_days(budget, price_cents=20000)

        assert result == 7

    def test_no_max_allows_unlimited(self, db: Session) -> None:
        """Without max, cooloff can grow indefinitely."""
        user = get_test_user(db)
        budget = reset_budget(db, user)
        budget.cooloff_scaling_cents = 10000  # $100
        budget.cooloff_scaling_days = 3
        budget.cooloff_max_days = None  # Explicitly no max
        budget.cooloff_min_threshold_cents = None  # No threshold
        budget.cooloff_min_threshold_days = 0
        budget.cooloff_base_days = 0
        db.add(budget)
        db.commit()

        # $1000 item needs 30 days
        result = calculate_required_cooloff_days(budget, price_cents=100000)

        assert result == 30


class TestManualUnfreeze:
    """Test manual unfreeze endpoint - like Abed breaking the fourth wall."""

    def test_manual_unfreeze_restores_rate(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Manual unfreeze should restore original rate immediately."""
        user = get_test_user(db)
        budget = reset_budget(db, user)
        original_rate = budget.monthly_rate_cents

        apply_freeze(db, budget, freeze_days=7)

        # Verify frozen
        assert is_budget_frozen(budget)

        response = client.post(
            f"{settings.API_V1_STR}/budget/unfreeze",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        content = response.json()
        assert content["monthly_rate_cents"] == original_rate
        assert content["stashed_monthly_rate_cents"] is None
        assert content["freeze_until"] is None

    def test_manual_unfreeze_when_not_frozen(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Manual unfreeze on non-frozen budget should be a no-op."""
        user = get_test_user(db)
        budget = reset_budget(db, user)

        # Not frozen
        assert not is_budget_frozen(budget)

        response = client.post(
            f"{settings.API_V1_STR}/budget/unfreeze",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        content = response.json()
        assert content["monthly_rate_cents"] == 60000
        assert content["stashed_monthly_rate_cents"] is None


class TestCooldownWaiver:
    """Test cooldown waiver - like Britta waiving her activist principles."""

    def test_cannot_waive_cooldown_on_purchased_item(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Cannot waive cooldown on a purchased item."""
        user = get_test_user(db)
        reset_budget(db, user)

        # Create and purchase item
        item = create_test_item(db, user, price_cents=5000)
        client.post(
            f"{settings.API_V1_STR}/wishlist/{item.id}/purchase",
            headers=superuser_token_headers,
        )

        # Attempt to waive cooldown
        response = client.post(
            f"{settings.API_V1_STR}/wishlist/{item.id}/waive-cooldown",
            headers=superuser_token_headers,
            json={"reason": "Troy's urgent action figure need"},
        )

        assert response.status_code == 400
        content = response.json()
        assert "only waive cooldown on wishlisted items" in content["detail"].lower()

    def test_cannot_waive_cooldown_on_mature_item(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Cannot waive cooldown on item that's already past cooldown."""
        user = get_test_user(db)
        budget = reset_budget(db, user)
        budget.cooloff_base_days = 7
        db.add(budget)
        db.commit()

        # Create item added 30 days ago (past cooldown)
        item = create_test_item(
            db,
            user,
            price_cents=5000,
            added_at=datetime.now(timezone.utc) - timedelta(days=30),
        )

        # Attempt to waive cooldown
        response = client.post(
            f"{settings.API_V1_STR}/wishlist/{item.id}/waive-cooldown",
            headers=superuser_token_headers,
            json={"reason": "Annie's unnecessary urgency"},
        )

        assert response.status_code == 400
        content = response.json()
        assert "not currently in cooldown period" in content["detail"].lower()

    def test_cannot_waive_cooldown_twice(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Cannot waive cooldown on item that already has waived cooldown."""
        user = get_test_user(db)
        budget = reset_budget(db, user)
        budget.cooloff_base_days = 7
        db.add(budget)
        db.commit()

        # Create item in cooldown
        item = create_test_item(db, user, price_cents=5000)

        # First waiver succeeds
        response = client.post(
            f"{settings.API_V1_STR}/wishlist/{item.id}/waive-cooldown",
            headers=superuser_token_headers,
            json={"reason": "Pierce's first emergency"},
        )
        assert response.status_code == 200

        # Second waiver fails
        response = client.post(
            f"{settings.API_V1_STR}/wishlist/{item.id}/waive-cooldown",
            headers=superuser_token_headers,
            json={"reason": "Pierce's second emergency"},
        )

        assert response.status_code == 400
        content = response.json()
        assert "cooldown already waived" in content["detail"].lower()

    def test_waived_item_can_be_purchased_without_freeze(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Waived cooldown allows purchase without budget freeze."""
        user = get_test_user(db)
        budget = reset_budget(db, user)
        budget.cooloff_base_days = 7  # Would trigger freeze
        budget.freeze_penalty_days = 7
        db.add(budget)
        db.commit()

        # Create item (newly added, would trigger freeze normally)
        item = create_test_item(db, user, price_cents=5000)

        # Waive cooldown
        response = client.post(
            f"{settings.API_V1_STR}/wishlist/{item.id}/waive-cooldown",
            headers=superuser_token_headers,
            json={"reason": "Abed's legitimate DVD emergency"},
        )
        assert response.status_code == 200

        # Purchase the item
        response = client.post(
            f"{settings.API_V1_STR}/wishlist/{item.id}/purchase",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200

        # Budget should NOT be frozen
        db.refresh(budget)
        assert not is_budget_frozen(budget)
        assert budget.monthly_rate_cents == 60000
        assert budget.stashed_monthly_rate_cents is None
        assert budget.freeze_until is None

    def test_non_waived_young_item_still_triggers_freeze(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Non-waived young item still triggers freeze penalty."""
        user = get_test_user(db)
        budget = reset_budget(db, user)
        budget.cooloff_base_days = 7
        budget.freeze_penalty_days = 7
        db.add(budget)
        db.commit()

        # Create item without waiving cooldown
        item = create_test_item(db, user, price_cents=5000)

        # Purchase the item
        response = client.post(
            f"{settings.API_V1_STR}/wishlist/{item.id}/purchase",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200

        # Budget SHOULD be frozen
        db.refresh(budget)
        assert is_budget_frozen(budget)
        assert budget.monthly_rate_cents == 0
        assert budget.stashed_monthly_rate_cents == 60000
        assert budget.freeze_until is not None
