from fastapi import APIRouter

from app.api.routes import private, utils
from app.core.config import settings
from app.features.auth.router import router as auth_router
from app.features.budget.router import router as budget_router
from app.features.category.router import router as category_router
from app.features.notification.router import router as notification_router
from app.features.price_tracking.router import router as price_tracking_router
from app.features.push.router import router as push_router
from app.features.tracking.router import router as tracking_router
from app.features.url_parser.router import router as url_parser_router
from app.features.users.router import router as users_router
from app.features.wishlist_item.router import router as wishlist_router
from app.features.wishlist_share.router import router as wishlist_share_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(utils.router)
api_router.include_router(budget_router)
api_router.include_router(category_router)
api_router.include_router(notification_router)
api_router.include_router(wishlist_router)
api_router.include_router(wishlist_share_router)
api_router.include_router(url_parser_router)
api_router.include_router(push_router)
api_router.include_router(tracking_router)
api_router.include_router(price_tracking_router)


if settings.ENVIRONMENT == "local":
    api_router.include_router(private.router)
