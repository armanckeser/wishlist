"""Push notification service for web push subscriptions."""

import json
import logging
import uuid

from pywebpush import WebPushException, webpush
from sqlmodel import Session, select

from app.core.config import settings
from app.features.push.models import PushSubscription, PushSubscriptionCreate

logger = logging.getLogger(__name__)


def subscribe(
    session: Session,
    user_id: uuid.UUID,
    subscription: PushSubscriptionCreate,
) -> PushSubscription:
    """
    Create or update a push subscription for a user.

    Upserts by endpoint - if the endpoint already exists, updates the keys.
    """
    existing = session.exec(
        select(PushSubscription).where(
            PushSubscription.endpoint == subscription.endpoint
        )
    ).first()

    if existing:
        existing.user_id = user_id
        existing.p256dh_key = subscription.p256dh_key
        existing.auth_key = subscription.auth_key
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing

    push_subscription = PushSubscription(
        user_id=user_id,
        endpoint=subscription.endpoint,
        p256dh_key=subscription.p256dh_key,
        auth_key=subscription.auth_key,
    )
    session.add(push_subscription)
    session.commit()
    session.refresh(push_subscription)
    return push_subscription


def unsubscribe(
    session: Session,
    user_id: uuid.UUID,
    endpoint: str,
) -> bool:
    """
    Remove a push subscription for a user.

    Returns True if subscription was found and deleted, False otherwise.
    """
    statement = select(PushSubscription).where(
        PushSubscription.user_id == user_id,
        PushSubscription.endpoint == endpoint,
    )
    subscription = session.exec(statement).first()

    if not subscription:
        return False

    session.delete(subscription)
    session.commit()
    return True


def get_user_subscriptions(
    session: Session,
    user_id: uuid.UUID,
) -> list[PushSubscription]:
    """Get all push subscriptions for a user."""
    statement = select(PushSubscription).where(PushSubscription.user_id == user_id)
    return list(session.exec(statement).all())


def send_push_notification(
    session: Session,
    user_id: uuid.UUID,
    title: str,
    body: str,
    url: str | None = None,
    tag: str | None = None,
    image: str | None = None,
) -> int:
    """
    Send a push notification to all of a user's subscribed devices.

    Args:
        session: Database session.
        user_id: User to send notification to.
        title: Notification title.
        body: Notification body text.
        url: Optional URL to open when notification is clicked.
        tag: Optional tag for notification grouping/replacement.
        image: Optional image URL to show in notification.

    Returns:
        Number of successful deliveries.
    """
    if not settings.push_enabled:
        logger.debug("Push notifications disabled - VAPID keys not configured")
        return 0

    subscriptions = get_user_subscriptions(session, user_id)
    if not subscriptions:
        return 0

    payload = {
        "title": title,
        "body": body,
    }
    if url:
        payload["url"] = url
    if tag:
        payload["tag"] = tag
    if image:
        payload["image"] = image

    successful = 0
    stale_endpoints: list[PushSubscription] = []

    for subscription in subscriptions:
        subscription_info = {
            "endpoint": subscription.endpoint,
            "keys": {
                "p256dh": subscription.p256dh_key,
                "auth": subscription.auth_key,
            },
        }

        try:
            webpush(
                subscription_info=subscription_info,
                data=json.dumps(payload),
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_SUBJECT},
            )
            successful += 1
        except WebPushException as error:
            if error.response is not None and error.response.status_code in (404, 410):
                logger.info(
                    "Stale push subscription (status %d), marking for removal: %s",
                    error.response.status_code,
                    subscription.endpoint[:50],
                )
                stale_endpoints.append(subscription)
            else:
                logger.warning(
                    "Failed to send push notification: %s",
                    error,
                )

    for stale_subscription in stale_endpoints:
        session.delete(stale_subscription)

    if stale_endpoints:
        session.commit()
        logger.info("Removed %d stale push subscriptions", len(stale_endpoints))

    return successful
