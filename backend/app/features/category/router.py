"""Category routes for managing categories."""

import uuid

from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep
from app.features.category.models import (
    CategoriesPublic,
    CategoryCreate,
    CategoryPublic,
    CategorySuggestionPublic,
    CategorySuggestionRequest,
    CategorySuggestionsPublic,
    CategoryUpdate,
)
from app.features.category.service import (
    category_to_public,
    create_category,
    delete_category,
    get_categories_for_user,
    get_owned_category,
    update_category,
)
from app.features.category.suggestion_service import (
    SuggestionInput,
    suggest_categories,
)
from app.shared.models import Message

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/", response_model=CategoriesPublic)
def read_categories(
    session: SessionDep,
    current_user: CurrentUser,
) -> CategoriesPublic:
    """Retrieve current user's categories."""
    categories = get_categories_for_user(session, current_user.id)
    return CategoriesPublic(
        data=[category_to_public(category) for category in categories],
        count=len(categories),
    )


@router.post("/", response_model=CategoryPublic)
def create_new_category(
    session: SessionDep,
    current_user: CurrentUser,
    category_in: CategoryCreate,
) -> CategoryPublic:
    """Create a new category."""
    category = create_category(session, category_in, current_user.id)
    return category_to_public(category)


@router.get("/{category_id}", response_model=CategoryPublic)
def read_category(
    session: SessionDep,
    current_user: CurrentUser,
    category_id: uuid.UUID,
) -> CategoryPublic:
    """Get a specific category by ID."""
    category = get_owned_category(session, category_id, current_user.id)
    return category_to_public(category)


@router.patch("/{category_id}", response_model=CategoryPublic)
def update_category_endpoint(
    session: SessionDep,
    current_user: CurrentUser,
    category_id: uuid.UUID,
    category_in: CategoryUpdate,
) -> CategoryPublic:
    """Update a category."""
    category = update_category(session, category_id, category_in, current_user.id)
    return category_to_public(category)


@router.delete("/{category_id}")
def delete_category_endpoint(
    session: SessionDep,
    current_user: CurrentUser,
    category_id: uuid.UUID,
) -> Message:
    """Delete a category."""
    delete_category(session, category_id, current_user.id)
    return Message(message="Category deleted successfully")


@router.post("/suggestions", response_model=CategorySuggestionsPublic)
def get_category_suggestions(
    session: SessionDep,
    current_user: CurrentUser,
    request: CategorySuggestionRequest,
) -> CategorySuggestionsPublic:
    """Get category suggestions for a product.

    Uses multiple strategies to suggest categories:
    - Domain history: Categories commonly assigned to items from this domain
    - Title matching: Category names that appear in the product title
    - Breadcrumb matching: Breadcrumbs from structured data that match categories
    - Brand history: Categories assigned to items with this brand
    - Structured data: Direct category from page metadata
    """
    input_data = SuggestionInput(
        product_url=request.product_url,
        title=request.title,
        breadcrumbs=request.breadcrumbs,
        brand=request.brand,
        category=request.category,
    )

    suggestions = suggest_categories(
        session=session,
        user_id=current_user.id,
        input_data=input_data,
        threshold=0.3,
        limit=5,
    )

    return CategorySuggestionsPublic(
        suggestions=[
            CategorySuggestionPublic(
                category_id=s.category_id,
                category_name=s.category_name,
                confidence=s.confidence,
                source=s.source,
            )
            for s in suggestions
        ]
    )
