"""Background job: daily price checks for wishlist items.

The job is scheduled frequently (hourly by default) but only picks up items
that haven't been checked for ~a day, so each item is checked about once per
day regardless of when the worker (re)starts. Tracking is automatic: an item
just needs a product link to be a candidate - the check itself is what
establishes whether the page can be read at all.

Requests to the *same* store are still made one at a time with a random
delay, exactly as before, so a batch never looks like a scrape burst to any
one site. Different stores, though, don't compete for the same rate limit,
so their item groups run concurrently - this is what keeps a growing batch
fast without changing the request pattern any single site sees.

Each item gets its own DB session so one bad page can't roll back the rest.
"""

import asyncio
import logging
import os
import random
import uuid
from collections import defaultdict
from urllib.parse import urlparse

from sqlmodel import Session

from app.core.config import settings
from app.core.db import engine
from app.features.price_tracking.models import PriceCheckOutcome, PricePointSource
from app.features.price_tracking.service import (
    check_item_price,
    get_items_due_for_check,
)
from app.features.wishlist_item.models import WishlistItem

logger = logging.getLogger(__name__)

# Pause between requests to the same store so a batch doesn't look like a
# scrape burst.
MIN_DELAY_SECONDS = 2.0
MAX_DELAY_SECONDS = 6.0

# Upper bound on how many different stores we hit at once. Each item opens
# its own DB session and HTTP client, so this also caps resource usage on a
# batch that spans many domains.
MAX_CONCURRENT_DOMAINS = 8


async def check_one_item(item_id: uuid.UUID) -> PriceCheckOutcome | None:
    """Check a single item in its own session. Never raises."""
    try:
        with Session(engine) as session:
            item = session.get(WishlistItem, item_id)
            if (
                item is None
                or item.price_tracking_disabled_by_user
                or item.price_tracking_paused_at is not None
            ):
                return None
            result = await check_item_price(
                session, item, source=PricePointSource.SCHEDULED
            )
            return result.outcome
    except Exception:
        logger.exception("Unhandled error while checking price for item %s", item_id)
        return None


def _domain_key(product_url: str | None) -> str:
    """Group items by store so same-site requests stay serialized."""
    if not product_url:
        return ""
    return urlparse(product_url).netloc.lower()


async def _check_domain_group(
    item_ids: list[uuid.UUID], semaphore: asyncio.Semaphore
) -> dict[PriceCheckOutcome, int]:
    """Check every item for one store, one at a time with a jittered delay."""
    counts: dict[PriceCheckOutcome, int] = {}
    async with semaphore:
        for index, item_id in enumerate(item_ids):
            outcome = await check_one_item(item_id)
            if outcome is not None:
                counts[outcome] = counts.get(outcome, 0) + 1
            if index < len(item_ids) - 1:
                await asyncio.sleep(
                    random.uniform(MIN_DELAY_SECONDS, MAX_DELAY_SECONDS)
                )
    return counts


async def check_tracked_prices() -> int:
    """Check every item that is due. Returns the number of items processed."""
    if not settings.PRICE_TRACKING_ENABLED:
        logger.info("Price check skipped: PRICE_TRACKING_ENABLED=false")
        return 0

    logger.info("Starting price check job (worker PID: %d)...", os.getpid())

    with Session(engine) as session:
        due_items = get_items_due_for_check(
            session, limit=settings.PRICE_CHECK_BATCH_SIZE
        )
        by_domain: dict[str, list[uuid.UUID]] = defaultdict(list)
        for item in due_items:
            by_domain[_domain_key(item.product_url)].append(item.id)

    if not by_domain:
        logger.info("No items due for a price check")
        return 0

    total = sum(len(ids) for ids in by_domain.values())
    logger.info(
        "Checking prices for %d items across %d stores...", total, len(by_domain)
    )

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_DOMAINS)
    group_results = await asyncio.gather(
        *(_check_domain_group(ids, semaphore) for ids in by_domain.values())
    )

    counts: dict[PriceCheckOutcome, int] = {}
    for group_counts in group_results:
        for outcome, count in group_counts.items():
            counts[outcome] = counts.get(outcome, 0) + count

    logger.info(
        "Price check complete: %d items (%s)",
        total,
        ", ".join(f"{k.value}={v}" for k, v in counts.items()) or "no results",
    )
    return total
