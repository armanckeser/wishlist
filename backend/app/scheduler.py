"""APScheduler configuration for background jobs.

## IMPORTANT: Single Process Only

APScheduler's SQLAlchemyJobStore does NOT provide inter-process coordination.
The scheduler MUST run in a single dedicated process, NOT in FastAPI workers.

Run with: python -m app.scheduler_worker

### Why SQLAlchemyJobStore Doesn't Coordinate

- SQLAlchemyJobStore is for **persistence**, not coordination
- Each process runs its own scheduler loop independently
- No distributed locking between processes
- Result: Multiple processes = duplicate job execution

### Architecture

```
Container:
  ├─ Scheduler Process (scheduler_worker.py) - Runs background jobs
  └─ FastAPI Workers (x4) - Handle HTTP requests only
```

Only the dedicated scheduler process runs jobs. FastAPI workers don't start schedulers.
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import Settings

logger = logging.getLogger(__name__)


def create_scheduler() -> AsyncIOScheduler:
    """Create scheduler for standalone process.

    Uses in-memory job storage since jobs are reconfigured on every startup.
    No need for database persistence.

    Returns:
        Configured AsyncIOScheduler instance
    """
    # NO ThreadPoolExecutor - AsyncIOScheduler runs async jobs in event loop
    # NO jobstore - jobs are configured on startup, no persistence needed
    job_defaults = {
        "coalesce": True,  # Combine multiple missed runs into one
        "max_instances": 1,  # Only one instance of each job at a time
        "misfire_grace_time": 60,  # Jobs can be 60s late
    }

    return AsyncIOScheduler(job_defaults=job_defaults)


# Module-level scheduler instance (created during configure_scheduler)
scheduler: AsyncIOScheduler | None = None


def configure_scheduler(settings: Settings) -> AsyncIOScheduler | None:
    """Configure scheduler with jobs based on settings.

    Adds the tracking sync job when the 17track API key is configured and
    the price check job when price tracking is enabled. Returns None when
    the scheduler is disabled or there is nothing to run.

    IMPORTANT: Should only be called from scheduler_worker.py, not from FastAPI workers.

    Args:
        settings: Application settings

    Returns:
        Configured scheduler instance, or None if scheduler is disabled
    """
    global scheduler

    if not settings.SCHEDULER_ENABLED:
        logger.info("Scheduler disabled via SCHEDULER_ENABLED=false")
        return None

    # Create scheduler (in-memory, no persistence needed)
    scheduler = create_scheduler()
    jobs_added = 0

    if settings.tracking_enabled:
        # Import here to avoid circular imports
        from app.background.tracking_sync import sync_tracking_with_notifications

        scheduler.add_job(
            sync_tracking_with_notifications,
            trigger=IntervalTrigger(minutes=settings.SCHEDULER_TRACKING_SYNC_MINUTES),
            id="tracking_sync",
            name="Sync tracking status and send notifications",
            replace_existing=True,
        )
        jobs_added += 1
        logger.info(
            "Scheduled tracking sync job every %d minutes",
            settings.SCHEDULER_TRACKING_SYNC_MINUTES,
        )
    else:
        logger.info("Tracking sync job skipped: SEVENTEENTRACK_SECURITY_KEY not set")

    if settings.PRICE_TRACKING_ENABLED:
        from app.background.price_check import check_tracked_prices

        scheduler.add_job(
            check_tracked_prices,
            trigger=IntervalTrigger(minutes=settings.SCHEDULER_PRICE_CHECK_MINUTES),
            id="price_check",
            name="Check prices of tracked wishlist items",
            replace_existing=True,
            # Job bodies can take a while (many slow stores); allow lateness.
            misfire_grace_time=600,
        )
        jobs_added += 1
        logger.info(
            "Scheduled price check job every %d minutes",
            settings.SCHEDULER_PRICE_CHECK_MINUTES,
        )
    else:
        logger.info("Price check job skipped: PRICE_TRACKING_ENABLED=false")

    if jobs_added == 0:
        scheduler = None
        return None

    return scheduler
