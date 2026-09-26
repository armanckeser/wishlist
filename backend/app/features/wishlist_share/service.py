"""WishlistShare service for database operations."""

import uuid

from sqlmodel import Session, select

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.features.users.models import User
from app.features.wishlist_share.models import WishlistShare, WishlistSharePublic


def get_user_by_email(session: Session, email: str) -> User | None:
    """Get a user by email address."""
    statement = select(User).where(User.email == email)
    return session.exec(statement).first()


def get_owned_share(
    session: Session,
    share_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> WishlistShare:
    """
    Get a share by ID, verifying ownership.

    Raises:
        NotFoundError: If share doesn't exist or doesn't belong to user.
    """
    share = session.get(WishlistShare, share_id)
    if not share or share.owner_id != owner_id:
        raise NotFoundError("Share")
    return share


def create_share(
    session: Session,
    owner_id: uuid.UUID,
    shared_with_email: str,
) -> WishlistShare:
    """
    Create a new wishlist share.

    Raises:
        ValidationError: If trying to share with self.
        NotFoundError: If shared_with_email user doesn't exist.
        ConflictError: If share already exists.
    """
    shared_with_user = get_user_by_email(session, shared_with_email)
    if not shared_with_user:
        raise NotFoundError("User", shared_with_email)

    if shared_with_user.id == owner_id:
        raise ValidationError("Cannot share wishlist with yourself")

    existing = session.exec(
        select(WishlistShare).where(
            WishlistShare.owner_id == owner_id,
            WishlistShare.shared_with_id == shared_with_user.id,
        )
    ).first()
    if existing:
        raise ConflictError("Wishlist already shared with this user")

    share = WishlistShare(owner_id=owner_id, shared_with_id=shared_with_user.id)
    session.add(share)
    session.commit()
    session.refresh(share)
    return share


def get_shares_by_owner(
    session: Session,
    owner_id: uuid.UUID,
) -> list[WishlistShare]:
    """Get all shares created by a user."""
    statement = select(WishlistShare).where(WishlistShare.owner_id == owner_id)
    return list(session.exec(statement).all())


def get_shares_with_user(
    session: Session,
    user_id: uuid.UUID,
) -> list[WishlistShare]:
    """Get all shares where user is the recipient."""
    statement = select(WishlistShare).where(WishlistShare.shared_with_id == user_id)
    return list(session.exec(statement).all())


def delete_share(
    session: Session,
    share_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> None:
    """
    Delete a share.

    Raises:
        NotFoundError: If share doesn't exist or doesn't belong to user.
    """
    share = get_owned_share(session, share_id, owner_id)
    session.delete(share)
    session.commit()


def share_to_public(session: Session, share: WishlistShare) -> WishlistSharePublic:
    """Convert a WishlistShare to its public representation."""
    owner = session.get(User, share.owner_id)
    shared_with = session.get(User, share.shared_with_id)
    return WishlistSharePublic(
        id=share.id,
        owner_id=share.owner_id,
        shared_with_id=share.shared_with_id,
        shared_with_email=shared_with.email if shared_with else "",
        owner_email=owner.email if owner else "",
        created_at=share.created_at,
    )


def can_view_wishlist(
    session: Session,
    viewer_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> bool:
    """
    Check if a user can view another user's wishlist.

    Returns True if:
    - viewer is the owner
    - owner's wishlist is public
    - there's a share from owner to viewer
    """
    if viewer_id == owner_id:
        return True

    owner = session.get(User, owner_id)
    if not owner:
        return False

    from app.features.users.models import WishlistVisibility

    if owner.wishlist_visibility == WishlistVisibility.PUBLIC:
        return True

    share = session.exec(
        select(WishlistShare).where(
            WishlistShare.owner_id == owner_id,
            WishlistShare.shared_with_id == viewer_id,
        )
    ).first()
    return share is not None
