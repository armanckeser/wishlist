"""Test category suggestions against real product URLs in the database.

Run with: uv run python scripts/test_suggestions_live.py
"""

import asyncio
import uuid
from collections import defaultdict

from sqlmodel import Session, select

from app.core.db import engine
from app.features.category.models import Category
from app.features.category.suggestion_service import (
    SuggestionInput,
    suggest_categories,
)
from app.features.url_parser.service import parse_url
from app.features.wishlist_item.models import WishlistItem


def get_items_with_categories(
    session: Session,
) -> list[tuple[WishlistItem, list[Category]]]:
    """Get all wishlist items that have categories and product URLs."""
    statement = select(WishlistItem).where(
        WishlistItem.product_url.isnot(None),  # type: ignore[union-attr]
    )
    items = session.exec(statement).all()
    return [(item, list(item.categories)) for item in items if item.categories]


async def test_url_parsing(url: str) -> dict:
    """Parse a URL and return the extracted metadata."""
    try:
        metadata, method = await parse_url(url)
        return {
            "success": True,
            "title": metadata.title,
            "brand": metadata.brand,
            "category": metadata.category,
            "breadcrumbs": metadata.breadcrumbs,
            "method": method,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def test_suggestions(
    session: Session,
    user_id: uuid.UUID,
    product_url: str,
    title: str | None,
    brand: str | None,
    breadcrumbs: list[str] | None,
    category: str | None,
) -> list[dict[str, object]]:
    """Get category suggestions for a product."""
    input_data = SuggestionInput(
        product_url=product_url,
        title=title,
        brand=brand,
        breadcrumbs=breadcrumbs,
        category=category,
    )

    suggestions = suggest_categories(
        session=session,
        user_id=user_id,
        input_data=input_data,
        threshold=0.3,
        limit=5,
    )

    return [
        {
            "category": s.category_name,
            "confidence": round(s.confidence, 2),
            "source": s.source,
        }
        for s in suggestions
    ]


async def main():
    """Run tests against real product URLs."""
    print("=" * 80)
    print("CATEGORY SUGGESTION TEST - REAL PRODUCT URLs")
    print("=" * 80)

    with Session(engine) as session:
        items_with_categories = get_items_with_categories(session)

        if not items_with_categories:
            print("No items with categories and product URLs found in database.")
            return

        print(
            f"\nFound {len(items_with_categories)} items with categories and product URLs\n"
        )

        # Group by user
        by_user: dict[
            uuid.UUID, list[tuple[WishlistItem, list[Category]]]
        ] = defaultdict(list)
        for item, categories in items_with_categories:
            by_user[item.owner_id].append((item, categories))

        # Stats
        total_items = 0
        correct_suggestions = 0
        partial_matches = 0
        no_suggestions = 0
        parse_failures = 0

        for user_id, user_items in by_user.items():
            print(f"\n{'='*80}")
            print(f"USER: {str(user_id)[:8]}...")
            print(f"{'='*80}")

            for item, actual_categories in user_items:
                total_items += 1
                actual_names = {c.name for c in actual_categories}

                print(
                    f"\n--- Item: {item.title[:50]}{'...' if len(item.title) > 50 else ''}"
                )
                product_url = item.product_url or ""
                print(
                    f"    URL: {product_url[:60]}{'...' if len(product_url) > 60 else ''}"
                )
                print(f"    Actual categories: {', '.join(actual_names)}")

                # Parse URL to get metadata
                if item.product_url:
                    print("    Parsing URL...")
                    parsed = await test_url_parsing(item.product_url)

                    if not parsed["success"]:
                        print(f"    ❌ Parse failed: {parsed['error'][:50]}")
                        parse_failures += 1
                        # Still try suggestions with just the URL and title
                        parsed = {
                            "title": item.title,
                            "brand": None,
                            "breadcrumbs": None,
                            "category": None,
                        }
                    else:
                        if parsed.get("brand"):
                            print(f"    Brand: {parsed['brand']}")
                        if parsed.get("category"):
                            print(f"    Category (from page): {parsed['category']}")
                        if parsed.get("breadcrumbs"):
                            print(
                                f"    Breadcrumbs: {' > '.join(parsed['breadcrumbs'])}"
                            )

                    # Get suggestions
                    breadcrumbs_raw = parsed.get("breadcrumbs")
                    breadcrumbs: list[str] | None = (
                        breadcrumbs_raw if isinstance(breadcrumbs_raw, list) else None
                    )
                    title_str: str | None = parsed.get("title") or item.title
                    brand_str: str | None = parsed.get("brand")
                    category_str: str | None = parsed.get("category")
                    suggestions = test_suggestions(
                        session=session,
                        user_id=user_id,
                        product_url=item.product_url,
                        title=title_str,
                        brand=brand_str,
                        breadcrumbs=breadcrumbs,
                        category=category_str,
                    )

                    if suggestions:
                        print("    Suggestions:")
                        suggested_names = set()
                        for s in suggestions:
                            suggested_names.add(s["category"])
                            match_marker = "✓" if s["category"] in actual_names else " "
                            print(
                                f"      {match_marker} {s['category']} ({s['confidence']:.0%} - {s['source']})"
                            )

                        # Check if any suggestion matches actual categories
                        matches = suggested_names & actual_names
                        if matches:
                            if matches == actual_names:
                                correct_suggestions += 1
                                print(
                                    "    ✅ CORRECT - All actual categories suggested!"
                                )
                            else:
                                partial_matches += 1
                                print(f"    🟡 PARTIAL - Matched: {', '.join(matches)}")
                        else:
                            print(
                                "    ❌ NO MATCH - Suggestions don't match actual categories"
                            )
                    else:
                        no_suggestions += 1
                        print("    ⚪ No suggestions (below threshold)")

        # Summary
        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"Total items tested: {total_items}")
        print(
            f"Parse failures: {parse_failures} ({parse_failures/total_items*100:.1f}%)"
        )
        print(
            f"Correct suggestions: {correct_suggestions} ({correct_suggestions/total_items*100:.1f}%)"
        )
        print(
            f"Partial matches: {partial_matches} ({partial_matches/total_items*100:.1f}%)"
        )
        print(
            f"No suggestions: {no_suggestions} ({no_suggestions/total_items*100:.1f}%)"
        )

        accuracy = (
            (correct_suggestions + partial_matches) / total_items * 100
            if total_items > 0
            else 0
        )
        print(f"\nOverall accuracy (correct + partial): {accuracy:.1f}%")


if __name__ == "__main__":
    asyncio.run(main())
