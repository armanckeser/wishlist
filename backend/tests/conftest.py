"""Test configuration using in-memory SQLite database.

Uses SQLModel's recommended approach: in-memory SQLite with StaticPool
for test isolation. Each test gets a fresh database created from models.
"""

import sqlite3
import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import String, TypeDecorator
from sqlalchemy import Uuid as SAUuid
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.sql.type_api import TypeEngine
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.api.deps import get_db
from app.core.config import settings
from app.features.users.models import User, UserCreate
from app.features.users.service import create_user, get_user_by_email
from app.main import app
from tests.utils.user import authentication_token_from_email
from tests.utils.utils import get_superuser_token_headers

# Register UUID adapter for sqlite3 module (converts UUID -> str when binding params)
sqlite3.register_adapter(uuid.UUID, lambda u: str(u))


# Monkey-patch SQLAlchemy to use string UUIDs for SQLite
# This makes Uuid columns work transparently with SQLite


class SQLiteUUID(TypeDecorator):
    """UUID type that stores as string in SQLite but returns uuid.UUID."""

    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):  # noqa: ANN001, ANN202
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return str(value)
        return value

    def process_result_value(self, value, dialect):  # noqa: ANN001, ANN202
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(value)


_original_gen_dialect_impl = SAUuid._gen_dialect_impl


def _patched_gen_dialect_impl(self: SAUuid, dialect: Dialect) -> TypeEngine[uuid.UUID]:
    if dialect.name == "sqlite":
        return SQLiteUUID()
    return _original_gen_dialect_impl(self, dialect)


SAUuid._gen_dialect_impl = _patched_gen_dialect_impl  # type: ignore[method-assign]


@pytest.fixture(name="session")
def session_fixture() -> Generator[Session, None, None]:
    """Create a fresh in-memory SQLite database for each test.

    Uses StaticPool to share the same connection across the test,
    which is required for in-memory SQLite to persist data.
    """
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="db")
def db_fixture(session: Session) -> Session:
    """Alias for session fixture to maintain compatibility with existing tests."""
    return session


@pytest.fixture(name="client")
def client_fixture(session: Session) -> Generator[TestClient, None, None]:
    """Create test client with overridden database dependency."""

    def get_session_override() -> Generator[Session, None, None]:
        yield session

    app.dependency_overrides[get_db] = get_session_override
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture(name="superuser")
def superuser_fixture(session: Session) -> User:
    """Get or create the superuser for this test.

    Uses the existing superuser if present (from init_db), or creates one.
    """
    user = get_user_by_email(session=session, email=settings.FIRST_SUPERUSER)
    if user:
        return user

    user_in = UserCreate(
        email=settings.FIRST_SUPERUSER,
        password=settings.FIRST_SUPERUSER_PASSWORD,
        is_superuser=True,
    )
    return create_user(session=session, user_create=user_in)


@pytest.fixture(name="superuser_token_headers")
def superuser_token_headers_fixture(
    client: TestClient, superuser: User
) -> dict[str, str]:
    """Get auth headers for superuser."""
    return get_superuser_token_headers(client)


@pytest.fixture(name="normal_user_token_headers")
def normal_user_token_headers_fixture(
    client: TestClient, session: Session, superuser: User
) -> dict[str, str]:
    """Get auth headers for normal user (creates user if needed)."""
    return authentication_token_from_email(
        client=client, email=settings.EMAIL_TEST_USER, db=session
    )
