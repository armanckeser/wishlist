"""Smoke tests to catch import and startup issues early.

These tests verify that all critical modules can be imported without errors,
catching issues like the missing model imports in db.py that broke deployment.
"""


class TestImportSmoke:
    """Verify all critical modules import successfully."""

    def test_import_core_db(self) -> None:
        """db.py must import all models for SQLAlchemy relationships."""
        from app.core.db import engine, init_db

        assert engine is not None
        assert init_db is not None

    def test_import_core_models(self) -> None:
        """core/models.py must export all table models."""
        from app.core.models import (
            Budget,
            Category,
            ItemCategory,
            Notification,
            PushSubscription,
            User,
            WishlistItem,
            WishlistShare,
        )

        # Verify all models are actual SQLModel tables
        for model in [
            Budget,
            Category,
            ItemCategory,
            Notification,
            PushSubscription,
            User,
            WishlistItem,
            WishlistShare,
        ]:
            assert hasattr(
                model, "__tablename__"
            ), f"{model.__name__} missing __tablename__"

    def test_import_main_app(self) -> None:
        """FastAPI app must initialize without errors."""
        from app.main import app

        assert app is not None
        assert app.title is not None

    def test_import_all_routers(self) -> None:
        """All routers must import successfully."""
        from app.features.auth.router import router as auth_router
        from app.features.budget.router import router as budget_router
        from app.features.category.router import router as category_router
        from app.features.notification.router import router as notification_router
        from app.features.push.router import router as push_router
        from app.features.url_parser.router import router as url_parser_router
        from app.features.users.router import router as users_router
        from app.features.wishlist_item.router import router as wishlist_router
        from app.features.wishlist_share.router import router as wishlist_share_router

        routers = [
            auth_router,
            budget_router,
            category_router,
            notification_router,
            push_router,
            url_parser_router,
            users_router,
            wishlist_router,
            wishlist_share_router,
        ]
        for router in routers:
            assert router is not None

    def test_import_all_services(self) -> None:
        """All services must import successfully."""
        from app.features.budget import service as budget_service
        from app.features.category import service as category_service
        from app.features.notification import service as notification_service
        from app.features.push import service as push_service
        from app.features.users import service as users_service
        from app.features.wishlist_item import service as wishlist_service
        from app.features.wishlist_share import service as share_service

        services = [
            budget_service,
            category_service,
            notification_service,
            push_service,
            users_service,
            wishlist_service,
            share_service,
        ]
        for service in services:
            assert service is not None

    def test_prestart_scripts_import(self) -> None:
        """Prestart scripts must import without errors (deployment critical)."""
        # These are run during Docker container startup
        import app.backend_pre_start
        import app.initial_data

        assert app.backend_pre_start.main is not None
        assert app.initial_data.main is not None
