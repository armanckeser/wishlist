from sqlmodel import Session

from app.features.wishlist_item.models import WishlistItem, WishlistItemCreate
from app.features.wishlist_item.service import create_wishlist_item
from tests.utils.user import create_random_user
from tests.utils.utils import random_lower_string


def create_random_wishlist_item(db: Session) -> WishlistItem:
    user = create_random_user(db)
    owner_id = user.id
    assert owner_id is not None
    title = random_lower_string()
    description = random_lower_string()
    item_in = WishlistItemCreate(
        title=title,
        description=description,
        price_cents=1000,
    )
    return create_wishlist_item(session=db, item_create=item_in, owner_id=owner_id)


# Alias for backwards compatibility
create_random_item = create_random_wishlist_item
