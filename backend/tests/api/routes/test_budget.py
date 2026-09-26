"""Tests for budget PATCH endpoint.

Theme: Community's study group manages their budget like they manage
their group projects - with varying degrees of success.
"""

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.features.budget.models import Budget
from app.features.budget.service import get_or_create_budget
from app.features.users.models import User, UserCreate
from app.features.users.service import create_user, get_user_by_email


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
    budget.cooloff_max_days = None
    budget.freeze_penalty_days = 7
    budget.last_updated_at = datetime.now(timezone.utc)
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


# =============================================================================
# PATCH Budget Tests - "Winger knows how to adjust on the fly"
# =============================================================================


class TestBudgetPatchMonthlyRate:
    """Test updating monthly_rate_cents via PATCH."""

    def test_update_monthly_rate(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Jeff decides he deserves a raise - updates monthly rate from $600 to $800."""
        user = get_test_user(db)
        reset_budget(db, user)

        response = client.patch(
            f"{settings.API_V1_STR}/budget/",
            headers=superuser_token_headers,
            json={"monthly_rate_cents": 80000},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["monthly_rate_cents"] == 80000

    def test_update_monthly_rate_to_zero(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Britta goes on a spending freeze - sets rate to zero."""
        user = get_test_user(db)
        reset_budget(db, user)

        response = client.patch(
            f"{settings.API_V1_STR}/budget/",
            headers=superuser_token_headers,
            json={"monthly_rate_cents": 0},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["monthly_rate_cents"] == 0

    def test_update_monthly_rate_negative_rejected(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Pierce tries to game the system with negative rate - rejected."""
        user = get_test_user(db)
        reset_budget(db, user)

        response = client.patch(
            f"{settings.API_V1_STR}/budget/",
            headers=superuser_token_headers,
            json={"monthly_rate_cents": -5000},
        )

        assert response.status_code == 422  # Validation error


class TestBudgetPatchCentsAtLastUpdate:
    """Test updating cents_at_last_update via PATCH."""

    def test_update_cents_at_last_update(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Troy found some money in the couch - manual adjustment to $200."""
        user = get_test_user(db)
        reset_budget(db, user)

        response = client.patch(
            f"{settings.API_V1_STR}/budget/",
            headers=superuser_token_headers,
            json={"cents_at_last_update": 20000},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["cents_at_last_update"] == 20000

    def test_update_cents_negative_allowed(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Abed overspent on Inspector Spacetime memorabilia - negative balance."""
        user = get_test_user(db)
        reset_budget(db, user)

        response = client.patch(
            f"{settings.API_V1_STR}/budget/",
            headers=superuser_token_headers,
            json={"cents_at_last_update": -5000},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["cents_at_last_update"] == -5000


class TestBudgetPatchCooloffSettings:
    """Test updating cooloff settings via PATCH."""

    def test_update_cooloff_base_days(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Annie implements a 3-day waiting period for all purchases."""
        user = get_test_user(db)
        reset_budget(db, user)

        response = client.patch(
            f"{settings.API_V1_STR}/budget/",
            headers=superuser_token_headers,
            json={"cooloff_base_days": 3},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["cooloff_base_days"] == 3

    def test_update_cooloff_scaling(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Shirley sets up price-based scaling - $50 per 2 days."""
        user = get_test_user(db)
        reset_budget(db, user)

        response = client.patch(
            f"{settings.API_V1_STR}/budget/",
            headers=superuser_token_headers,
            json={
                "cooloff_scaling_cents": 5000,
                "cooloff_scaling_days": 2,
            },
        )

        assert response.status_code == 200
        content = response.json()
        assert content["cooloff_scaling_cents"] == 5000
        assert content["cooloff_scaling_days"] == 2

    def test_update_cooloff_threshold(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Dean Pelton requires minimum 14 days for items over $300."""
        user = get_test_user(db)
        reset_budget(db, user)

        response = client.patch(
            f"{settings.API_V1_STR}/budget/",
            headers=superuser_token_headers,
            json={
                "cooloff_min_threshold_cents": 30000,
                "cooloff_min_threshold_days": 14,
            },
        )

        assert response.status_code == 200
        content = response.json()
        assert content["cooloff_min_threshold_cents"] == 30000
        assert content["cooloff_min_threshold_days"] == 14

    def test_update_cooloff_max_days(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Chang caps cooloff at 30 days - even he has some limits."""
        user = get_test_user(db)
        reset_budget(db, user)

        response = client.patch(
            f"{settings.API_V1_STR}/budget/",
            headers=superuser_token_headers,
            json={"cooloff_max_days": 30},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["cooloff_max_days"] == 30

    def test_update_freeze_penalty_days(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """The group agrees on a 10-day freeze penalty for impulse buys."""
        user = get_test_user(db)
        reset_budget(db, user)

        response = client.patch(
            f"{settings.API_V1_STR}/budget/",
            headers=superuser_token_headers,
            json={"freeze_penalty_days": 10},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["freeze_penalty_days"] == 10


class TestBudgetPatchMultipleFields:
    """Test updating multiple fields at once."""

    def test_update_multiple_fields(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """The study group overhauls their entire budget strategy."""
        user = get_test_user(db)
        reset_budget(db, user)

        response = client.patch(
            f"{settings.API_V1_STR}/budget/",
            headers=superuser_token_headers,
            json={
                "monthly_rate_cents": 75000,
                "cents_at_last_update": 15000,
                "cooloff_base_days": 2,
                "cooloff_scaling_cents": 10000,
                "cooloff_scaling_days": 3,
                "freeze_penalty_days": 5,
            },
        )

        assert response.status_code == 200
        content = response.json()
        assert content["monthly_rate_cents"] == 75000
        assert content["cents_at_last_update"] == 15000
        assert content["cooloff_base_days"] == 2
        assert content["cooloff_scaling_cents"] == 10000
        assert content["cooloff_scaling_days"] == 3
        assert content["freeze_penalty_days"] == 5


class TestBudgetPatchFlushBehavior:
    """Test that PATCH flushes accrued value before applying updates."""

    def test_patch_flushes_accrued_value(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Updating rate should first flush any accumulated budget.

        Like when Jeff finally cashes in all his charm points before
        changing his strategy.
        """
        user = get_test_user(db)
        budget = reset_budget(db, user)

        # Set last_updated_at to 1 hour ago to accrue some value
        budget.last_updated_at = datetime.now(timezone.utc) - timedelta(hours=1)
        db.add(budget)
        db.commit()

        original_stored = budget.cents_at_last_update

        # Update the rate
        response = client.patch(
            f"{settings.API_V1_STR}/budget/",
            headers=superuser_token_headers,
            json={"monthly_rate_cents": 80000},
        )

        assert response.status_code == 200
        content = response.json()

        # cents_at_last_update should be higher than original due to flush
        # $600/month * 1 hour ≈ $0.82, so we should have more than original
        assert content["cents_at_last_update"] > original_stored


class TestBudgetPatchEmptyBody:
    """Test PATCH with empty or no updates."""

    def test_patch_empty_body(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Empty update should still work - just flushes accrued value."""
        user = get_test_user(db)
        reset_budget(db, user)

        response = client.patch(
            f"{settings.API_V1_STR}/budget/",
            headers=superuser_token_headers,
            json={},
        )

        assert response.status_code == 200
        content = response.json()
        # Should return valid budget response
        assert "monthly_rate_cents" in content
        assert "cents_at_last_update" in content
