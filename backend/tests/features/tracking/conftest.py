import pytest

from app.core.config import settings


@pytest.fixture(autouse=True)
def tracking_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    """Turn package tracking on, as a configured install has it.

    Tracking is on only when a 17track key is set, and the endpoints answer 503
    otherwise. No request reaches 17track: tests that sync mock the client, and
    tests about the disabled state patch settings themselves.
    """
    monkeypatch.setattr(settings, "SEVENTEENTRACK_SECURITY_KEY", "test-key")
