from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.core.security import verify_password
from app.features.users.models import UserCreate
from app.features.users.service import create_user
from app.utils import generate_password_reset_token
from tests.utils.user import create_random_user, user_authentication_headers
from tests.utils.utils import random_email, random_lower_string


def test_get_access_token(client: TestClient, superuser) -> None:  # noqa: ARG001
    login_data = {
        "username": settings.FIRST_SUPERUSER,
        "password": settings.FIRST_SUPERUSER_PASSWORD,
    }
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    tokens = r.json()
    assert r.status_code == 200
    assert "access_token" in tokens
    assert tokens["access_token"]


def test_get_access_token_incorrect_password(client: TestClient, superuser) -> None:  # noqa: ARG001
    login_data = {
        "username": settings.FIRST_SUPERUSER,
        "password": "incorrect",
    }
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    assert r.status_code == 400


def test_use_access_token(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/login/test-token",
        headers=superuser_token_headers,
    )
    result = r.json()
    assert r.status_code == 200
    assert "email" in result


def test_recovery_password(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    with (
        patch("app.core.config.settings.SMTP_HOST", "smtp.example.com"),
        patch("app.core.config.settings.SMTP_USER", "admin@example.com"),
    ):
        email = "test@example.com"
        r = client.post(
            f"{settings.API_V1_STR}/password-recovery/{email}",
            headers=normal_user_token_headers,
        )
        assert r.status_code == 200
        assert r.json() == {"message": "Password recovery email sent"}


def test_recovery_password_user_not_exits(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    email = "jVgQr@example.com"
    r = client.post(
        f"{settings.API_V1_STR}/password-recovery/{email}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 404


def test_reset_password(client: TestClient, db: Session) -> None:
    email = random_email()
    password = random_lower_string()
    new_password = random_lower_string()

    user_create = UserCreate(
        email=email,
        full_name="Test User",
        password=password,
        is_active=True,
        is_superuser=False,
    )
    user = create_user(session=db, user_create=user_create)
    token = generate_password_reset_token(email=email)
    headers = user_authentication_headers(client=client, email=email, password=password)
    data = {"new_password": new_password, "token": token}

    r = client.post(
        f"{settings.API_V1_STR}/reset-password/",
        headers=headers,
        json=data,
    )

    assert r.status_code == 200
    assert r.json() == {"message": "Password updated successfully"}

    db.refresh(user)
    assert verify_password(new_password, user.hashed_password)


def test_reset_password_invalid_token(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {"new_password": "changethis", "token": "invalid"}
    r = client.post(
        f"{settings.API_V1_STR}/reset-password/",
        headers=superuser_token_headers,
        json=data,
    )
    response = r.json()

    assert "detail" in response
    assert r.status_code == 400
    assert response["detail"] == "Invalid token"


def test_invalid_token_returns_401(client: TestClient) -> None:
    """Invalid token should return 401, not 403."""
    invalid_headers = {"Authorization": "Bearer invalid_token_here"}
    r = client.post(
        f"{settings.API_V1_STR}/login/test-token",
        headers=invalid_headers,
    )
    assert r.status_code == 401
    assert "Could not validate credentials" in r.json()["detail"]


def test_expired_token_returns_401(client: TestClient, db: Session) -> None:
    """Expired token should return 401."""
    from datetime import timedelta

    from app.core import security

    user = create_random_user(db)
    expired_token = security.create_access_token(
        user.id, expires_delta=timedelta(days=-1)
    )

    headers = {"Authorization": f"Bearer {expired_token}"}
    r = client.post(
        f"{settings.API_V1_STR}/login/test-token",
        headers=headers,
    )
    assert r.status_code == 401


def test_deleted_user_token_returns_401(client: TestClient, db: Session) -> None:
    """Token for deleted user should return 401."""
    email = random_email()
    password = random_lower_string()

    user_create = UserCreate(
        email=email,
        full_name="Test User",
        password=password,
        is_active=True,
        is_superuser=False,
    )
    user = create_user(session=db, user_create=user_create)

    headers = user_authentication_headers(client=client, email=email, password=password)

    # Delete user
    db.delete(user)
    db.commit()

    r = client.post(
        f"{settings.API_V1_STR}/login/test-token",
        headers=headers,
    )
    assert r.status_code == 401


def test_non_superuser_admin_access_returns_403(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    """Non-superuser accessing admin endpoints should get 403 (not 401)."""
    r = client.get(
        f"{settings.API_V1_STR}/users/",
        headers=normal_user_token_headers,
    )
    # 403 = valid auth, insufficient permissions
    assert r.status_code == 403
