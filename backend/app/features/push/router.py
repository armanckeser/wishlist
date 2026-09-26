"""Push notification routes for managing web push subscriptions."""

from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep
from app.core.config import settings
from app.features.push.models import (
    PushSubscriptionCreate,
    PushSubscriptionPublic,
    VapidKeyPublic,
)
from app.features.push.service import subscribe, unsubscribe
from app.shared.models import Message

router = APIRouter(prefix="/push", tags=["push"])


@router.get("/vapid-key", response_model=VapidKeyPublic)
def get_vapid_key() -> VapidKeyPublic:
    """Get the VAPID public key for push subscription."""
    return VapidKeyPublic(
        public_key=settings.VAPID_PUBLIC_KEY,
        enabled=settings.push_enabled,
    )


@router.post("/subscribe", response_model=PushSubscriptionPublic)
def subscribe_to_push(
    session: SessionDep,
    current_user: CurrentUser,
    subscription: PushSubscriptionCreate,
) -> PushSubscriptionPublic:
    """Subscribe to push notifications."""
    push_subscription = subscribe(session, current_user.id, subscription)
    return PushSubscriptionPublic(
        id=push_subscription.id,
        endpoint=push_subscription.endpoint,
        p256dh_key=push_subscription.p256dh_key,
        auth_key=push_subscription.auth_key,
        created_at=push_subscription.created_at,
    )


@router.post("/unsubscribe", response_model=Message)
def unsubscribe_from_push(
    session: SessionDep,
    current_user: CurrentUser,
    endpoint: str,
) -> Message:
    """Unsubscribe from push notifications."""
    removed = unsubscribe(session, current_user.id, endpoint)
    if removed:
        return Message(message="Unsubscribed from push notifications")
    return Message(message="Subscription not found")
