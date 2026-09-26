"""Tests for test pre-start database initialization."""

from sqlmodel import SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.tests_pre_start import init


def test_init_successful_connection() -> None:
    """Test that init successfully connects to the database."""
    # Create an in-memory SQLite database for testing
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)

    # Should not raise an exception
    init(engine)
