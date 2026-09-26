"""Standalone scheduler worker process.

Run this as a separate process to handle background jobs.
Do NOT run the scheduler inside FastAPI workers.

Usage:
    python -m app.scheduler_worker
"""

import asyncio
import logging
import signal
import sys

from app.core.config import settings
from app.scheduler import configure_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def main() -> None:
    """Run the scheduler as a standalone process."""
    logger.info("Starting scheduler worker process...")

    scheduler = configure_scheduler(settings)
    if not scheduler:
        logger.warning("Scheduler not configured (disabled or no jobs enabled)")
        return

    # Handle graceful shutdown
    shutdown_event = asyncio.Event()

    def handle_signal(sig: signal.Signals) -> None:
        logger.info("Received signal %s, shutting down...", sig.name)
        shutdown_event.set()

    loop = asyncio.get_event_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, handle_signal, sig)

    scheduler.start()
    logger.info("Scheduler started, waiting for shutdown signal...")

    # Wait for shutdown signal
    await shutdown_event.wait()

    logger.info("Shutting down scheduler...")
    scheduler.shutdown(wait=True)
    logger.info("Scheduler stopped")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
