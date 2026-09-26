"""Category service for database operations."""

import uuid

from sqlmodel import Session, select

from app.core.exceptions import NotFoundError, ValidationError
from app.features.category.models import (
    DEFAULT_CATEGORIES,
    Category,
    CategoryCreate,
    CategoryPublic,
    CategoryUpdate,
)


def get_owned_category(
    session: Session,
    category_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> Category:
    """
    Get a category by ID, verifying ownership.

    Raises:
        NotFoundError: If category doesn't exist or doesn't belong to user.
    """
    category = session.get(Category, category_id)
    if not category or category.owner_id != owner_id:
        raise NotFoundError("Category")
    return category


def create_category(
    session: Session,
    category_create: CategoryCreate,
    owner_id: uuid.UUID,
) -> Category:
    """
    Create a new category.

    Raises:
        NotFoundError: If parent_id is specified but doesn't exist.
        PermissionDeniedError: If parent doesn't belong to user.
    """
    if category_create.parent_id:
        get_owned_category(session, category_create.parent_id, owner_id)

    db_category = Category.model_validate(
        category_create, update={"owner_id": owner_id}
    )
    session.add(db_category)
    session.commit()
    session.refresh(db_category)
    return db_category


def get_categories_for_user(
    session: Session,
    owner_id: uuid.UUID,
) -> list[Category]:
    """Get all categories for a user."""
    statement = select(Category).where(Category.owner_id == owner_id)
    return list(session.exec(statement).all())


def get_category_by_id(
    session: Session,
    category_id: uuid.UUID,
) -> Category | None:
    """Get a category by ID."""
    return session.get(Category, category_id)


def category_to_public(category: Category) -> CategoryPublic:
    """Convert a Category to its public representation."""
    return CategoryPublic(
        id=category.id,
        name=category.name,
        parent_id=category.parent_id,
        created_at=category.created_at,
    )


def update_category(
    session: Session,
    category_id: uuid.UUID,
    category_update: CategoryUpdate,
    owner_id: uuid.UUID,
) -> Category:
    """
    Update a category.

    Raises:
        NotFoundError: If category or parent doesn't exist.
        PermissionDeniedError: If category or parent doesn't belong to user.
        ValidationError: If trying to set category as its own parent.
    """
    category = get_owned_category(session, category_id, owner_id)

    if category_update.parent_id is not None:
        if category_update.parent_id == category_id:
            raise ValidationError("Category cannot be its own parent")
        get_owned_category(session, category_update.parent_id, owner_id)

    update_dict = category_update.model_dump(exclude_unset=True)
    category.sqlmodel_update(update_dict)
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


def delete_category(
    session: Session,
    category_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> None:
    """
    Delete a category.

    Raises:
        NotFoundError: If category doesn't exist.
        PermissionDeniedError: If category doesn't belong to user.
    """
    category = get_owned_category(session, category_id, owner_id)
    session.delete(category)
    session.commit()


def create_default_categories_for_user(
    session: Session,
    owner_id: uuid.UUID,
) -> list[Category]:
    """Create default categories for a new user."""
    categories = []
    for name in DEFAULT_CATEGORIES:
        category = Category(name=name, owner_id=owner_id)
        session.add(category)
        categories.append(category)
    session.commit()
    for category in categories:
        session.refresh(category)
    return categories
