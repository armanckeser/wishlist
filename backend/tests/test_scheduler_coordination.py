"""Test scheduler configuration for standalone scheduler worker.

Note: These tests verify scheduler configuration only.
The scheduler should run as a single process (scheduler_worker.py), not in FastAPI workers.
"""

import pytest

from app.core.config import settings
from app.scheduler import configure_scheduler


def test_scheduler_configuration():
    """Scheduler should be properly configured with correct defaults."""
    if not settings.SCHEDULER_ENABLED or not settings.tracking_enabled:
        pytest.skip("Scheduler or tracking not enabled")

    scheduler = configure_scheduler(settings)
    assert scheduler is not None

    # Verify it's an AsyncIOScheduler
    assert scheduler.__class__.__name__ == "AsyncIOScheduler"

    # Check job defaults
    assert scheduler._job_defaults["max_instances"] == 1
    assert scheduler._job_defaults["coalesce"] is True
    assert scheduler._job_defaults["misfire_grace_time"] == 60


def test_scheduler_tracking_job():
    """Scheduler should have tracking sync job configured."""
    if not settings.SCHEDULER_ENABLED or not settings.tracking_enabled:
        pytest.skip("Scheduler or tracking not enabled")

    scheduler = configure_scheduler(settings)
    assert scheduler is not None

    # Verify tracking sync job exists
    job = scheduler.get_job("tracking_sync")
    assert job is not None
    assert job.id == "tracking_sync"
    assert job.name == "Sync tracking status and send notifications"


def test_scheduler_without_tracking_still_runs_price_checks(monkeypatch):
    """Without a 17track key the scheduler should only carry the price check job."""
    # tracking_enabled is a property based on SEVENTEENTRACK_SECURITY_KEY
    monkeypatch.setattr(settings, "SEVENTEENTRACK_SECURITY_KEY", None)
    monkeypatch.setattr(settings, "SCHEDULER_ENABLED", True)
    monkeypatch.setattr(settings, "PRICE_TRACKING_ENABLED", True)

    scheduler = configure_scheduler(settings)
    assert scheduler is not None
    assert scheduler.get_job("tracking_sync") is None

    job = scheduler.get_job("price_check")
    assert job is not None
    assert job.name == "Check prices of tracked wishlist items"


def test_scheduler_disabled_when_no_jobs_enabled(monkeypatch):
    """Scheduler should return None when there is nothing to run."""
    monkeypatch.setattr(settings, "SEVENTEENTRACK_SECURITY_KEY", None)
    monkeypatch.setattr(settings, "SCHEDULER_ENABLED", True)
    monkeypatch.setattr(settings, "PRICE_TRACKING_ENABLED", False)

    scheduler = configure_scheduler(settings)
    assert scheduler is None


def test_price_check_job_skipped_when_price_tracking_disabled(monkeypatch):
    """PRICE_TRACKING_ENABLED=false must not schedule the price check job."""
    monkeypatch.setattr(settings, "SEVENTEENTRACK_SECURITY_KEY", "test-key")
    monkeypatch.setattr(settings, "SCHEDULER_ENABLED", True)
    monkeypatch.setattr(settings, "PRICE_TRACKING_ENABLED", False)

    scheduler = configure_scheduler(settings)
    assert scheduler is not None
    assert scheduler.get_job("tracking_sync") is not None
    assert scheduler.get_job("price_check") is None


def test_scheduler_disabled_when_scheduler_disabled(monkeypatch):
    """Scheduler should return None when SCHEDULER_ENABLED is False."""
    monkeypatch.setattr(settings, "SCHEDULER_ENABLED", False)

    scheduler = configure_scheduler(settings)
    assert scheduler is None
