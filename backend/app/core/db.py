from datetime import timedelta

from sqlmodel import Session, create_engine, select

from app.core.config import settings
from app.features.budget.models import Budget
from app.features.category.models import Category, ItemCategory
from app.features.notification.models import Notification
from app.features.push.models import PushSubscription
from app.features.users.models import User, UserCreate
from app.features.users.service import create_user
from app.features.wishlist_item.models import WishlistItem
from app.features.wishlist_share.models import WishlistShare

# All table models must be imported for SQLAlchemy to resolve relationships
_ = (
    User,
    Budget,
    WishlistItem,
    Category,
    ItemCategory,
    WishlistShare,
    Notification,
    PushSubscription,
)

# pool_pre_ping validates a pooled connection before each checkout, so a
# connection killed server-side (e.g. Postgres "terminating connection due to
# administrator command" under memory pressure on the self-hosted Pi) is
# transparently discarded and replaced instead of surfacing as a 500.
# pool_recycle retires connections older than the interval so they never sit
# idle long enough to be reaped by the server in the first place.
_POOL_RECYCLE = timedelta(minutes=30)

engine = create_engine(
    str(settings.SQLALCHEMY_DATABASE_URI),
    pool_pre_ping=True,
    pool_recycle=int(_POOL_RECYCLE.total_seconds()),
)


def init_db(session: Session) -> None:
    """Initialize the database with the first superuser."""
    user = session.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    if not user:
        user_in = UserCreate(
            email=settings.FIRST_SUPERUSER,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            is_superuser=True,
        )
        user = create_user(session=session, user_create=user_in)
