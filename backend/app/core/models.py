"""Central model registry - import all SQLModel tables in dependency order.

This ensures SQLAlchemy can resolve all relationship string references.
Import models from here instead of directly from feature modules to avoid
circular import issues.
"""

# Models with no dependencies on other app models
from app.features.budget.models import Budget
from app.features.category.models import Category, ItemCategory
from app.features.notification.models import Notification
from app.features.price_tracking.models import PricePoint
from app.features.push.models import PushSubscription

# Models that reference the above (import order matters)
from app.features.users.models import User
from app.features.wishlist_item.models import WishlistItem
from app.features.wishlist_share.models import WishlistShare

__all__ = [
    "Budget",
    "Category",
    "ItemCategory",
    "Notification",
    "PricePoint",
    "PushSubscription",
    "User",
    "WishlistItem",
    "WishlistShare",
]
