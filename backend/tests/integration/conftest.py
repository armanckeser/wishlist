"""Conftest for integration tests - no database required.

Integration tests hit real external sites and don't need the FastAPI app
or database. Override the parent conftest fixtures to avoid DB connection.
"""

import pytest


# Override parent conftest's autouse db fixture
@pytest.fixture(scope="session", autouse=True)
def db():
    """Override db fixture - integration tests don't need database."""
    # No-op: skip database initialization for integration tests
    yield None


# Prevent other fixtures from running
@pytest.fixture(scope="module")
def client():
    """Override client fixture - not needed for integration tests."""
    yield None


@pytest.fixture(scope="module")
def superuser_token_headers():
    """Override auth fixture - not needed for integration tests."""
    yield {}


@pytest.fixture(scope="module")
def normal_user_token_headers():
    """Override auth fixture - not needed for integration tests."""
    yield {}
