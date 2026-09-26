"""WishlistShare routes for managing wishlist sharing."""

import uuid

from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep
from app.features.wishlist_share.models import (
    WishlistShareCreate,
    WishlistSharePublic,
    WishlistSharesPublic,
)
from app.features.wishlist_share.service import (
    create_share,
    delete_share,
    get_shares_by_owner,
    get_shares_with_user,
    share_to_public,
)
from app.shared.models import Message

router = APIRouter(prefix="/shares", tags=["shares"])


@router.post("/", response_model=WishlistSharePublic)
def create_new_share(
    session: SessionDep,
    current_user: CurrentUser,
    share_in: WishlistShareCreate,
) -> WishlistSharePublic:
    """Share your wishlist with another user by email."""
    share = create_share(session, current_user.id, share_in.shared_with_email)
    return share_to_public(session, share)


@router.get("/", response_model=WishlistSharesPublic)
def read_my_shares(
    session: SessionDep,
    current_user: CurrentUser,
) -> WishlistSharesPublic:
    """Get all shares you've created (wishlists you've shared with others)."""
    shares = get_shares_by_owner(session, current_user.id)
    return WishlistSharesPublic(
        data=[share_to_public(session, share) for share in shares],
        count=len(shares),
    )


@router.get("/with-me", response_model=WishlistSharesPublic)
def read_shares_with_me(
    session: SessionDep,
    current_user: CurrentUser,
) -> WishlistSharesPublic:
    """Get all wishlists shared with you by others."""
    shares = get_shares_with_user(session, current_user.id)
    return WishlistSharesPublic(
        data=[share_to_public(session, share) for share in shares],
        count=len(shares),
    )


@router.delete("/{share_id}")
def delete_share_endpoint(
    session: SessionDep,
    current_user: CurrentUser,
    share_id: uuid.UUID,
) -> Message:
    """Revoke a share you've created."""
    delete_share(session, share_id, current_user.id)
    return Message(message="Share revoked successfully")
