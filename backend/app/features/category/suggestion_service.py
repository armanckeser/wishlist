"""Category suggestion service for auto-categorizing products.

Provides intelligent category suggestions based on:
1. Domain history: What categories has the user assigned to products from this domain?
2. Title matching: Do words in the title match any of the user's category names?
3. Breadcrumb matching: Do breadcrumbs from structured data match category names?
"""

import uuid
from collections import Counter
from dataclasses import dataclass
from urllib.parse import urlparse

from sqlmodel import Session, select

from app.features.category.models import Category
from app.features.wishlist_item.models import WishlistItem


@dataclass
class CategorySuggestion:
    """A suggested category with confidence score."""

    category_id: uuid.UUID
    category_name: str
    confidence: float  # 0.0 to 1.0
    source: str  # e.g., "domain_history", "title_match", "breadcrumb_match"


def _extract_domain(url: str) -> str:
    """Extract normalized domain from URL."""
    parsed = urlparse(url)
    domain = parsed.netloc.lower()
    if domain.startswith("www."):
        domain = domain[4:]
    return domain


def _normalize_text(text: str) -> set[str]:
    """Normalize text to lowercase words for matching."""
    return {word.lower().strip() for word in text.split() if len(word) >= 3}


def _get_user_items_with_categories(
    session: Session, user_id: uuid.UUID
) -> list[tuple[WishlistItem, list[Category]]]:
    """Get all user's wishlist items with their categories."""
    statement = select(WishlistItem).where(WishlistItem.owner_id == user_id)
    items = session.exec(statement).all()
    return [(item, list(item.categories)) for item in items]


def _get_user_categories(session: Session, user_id: uuid.UUID) -> list[Category]:
    """Get all categories for a user."""
    statement = select(Category).where(Category.owner_id == user_id)
    return list(session.exec(statement).all())


# Keyword → Category name mapping for cold-start suggestions.
# When product text contains these keywords, suggest matching user categories.
# Includes product types, descriptive words, and brand names.
KEYWORD_TO_CATEGORY: dict[str, list[str]] = {
    # ===================
    # SKINCARE
    # ===================
    # Product types
    "serum": ["skincare", "skin care", "beauty"],
    "moisturizer": ["skincare", "skin care", "beauty"],
    "cleanser": ["skincare", "skin care", "beauty"],
    "toner": ["skincare", "skin care", "beauty"],
    "cream": ["skincare", "skin care", "beauty"],
    "lotion": ["skincare", "skin care", "beauty"],
    "sunscreen": ["skincare", "skin care", "beauty"],
    "spf": ["skincare", "skin care", "beauty"],
    "eye cream": ["skincare", "skin care", "beauty"],
    "eye serum": ["skincare", "skin care", "beauty"],
    "face oil": ["skincare", "skin care", "beauty"],
    "facial oil": ["skincare", "skin care", "beauty"],
    "face wash": ["skincare", "skin care", "beauty"],
    "face mask": ["skincare", "skin care", "beauty"],
    "sheet mask": ["skincare", "skin care", "beauty"],
    "masque": ["skincare", "skin care", "beauty"],
    "essence": ["skincare", "skin care", "beauty"],
    "ampoule": ["skincare", "skin care", "beauty"],
    "exfoliator": ["skincare", "skin care", "beauty"],
    "exfoliant": ["skincare", "skin care", "beauty"],
    "peel": ["skincare", "skin care", "beauty"],
    "scrub": ["skincare", "skin care", "beauty"],
    "mist": ["skincare", "skin care", "beauty"],
    "balm": ["skincare", "skin care", "beauty"],
    "lip balm": ["skincare", "skin care", "beauty"],
    "body lotion": ["skincare", "skin care", "beauty"],
    "body cream": ["skincare", "skin care", "beauty"],
    "body oil": ["skincare", "skin care", "beauty"],
    "hand cream": ["skincare", "skin care", "beauty"],
    # Ingredients/descriptors
    "retinol": ["skincare", "skin care", "beauty"],
    "hyaluronic": ["skincare", "skin care", "beauty"],
    "vitamin c": ["skincare", "skin care", "beauty"],
    "niacinamide": ["skincare", "skin care", "beauty"],
    "peptide": ["skincare", "skin care", "beauty"],
    "collagen": ["skincare", "skin care", "beauty"],
    "hydrating": ["skincare", "skin care", "beauty"],
    "anti-aging": ["skincare", "skin care", "beauty"],
    "wrinkle": ["skincare", "skin care", "beauty"],
    "acne": ["skincare", "skin care", "beauty"],
    "brightening": ["skincare", "skin care", "beauty"],
    "firming": ["skincare", "skin care", "beauty"],
    # Skincare brands
    "la mer": ["skincare", "skin care", "beauty"],
    "drunk elephant": ["skincare", "skin care", "beauty"],
    "tatcha": ["skincare", "skin care", "beauty"],
    "sk-ii": ["skincare", "skin care", "beauty"],
    "sunday riley": ["skincare", "skin care", "beauty"],
    "paula's choice": ["skincare", "skin care", "beauty"],
    "cerave": ["skincare", "skin care", "beauty"],
    "the ordinary": ["skincare", "skin care", "beauty"],
    "glossier": ["skincare", "skin care", "beauty"],
    "kiehl's": ["skincare", "skin care", "beauty"],
    "clinique": ["skincare", "skin care", "beauty"],
    "estee lauder": ["skincare", "skin care", "beauty"],
    "dermalogica": ["skincare", "skin care", "beauty"],
    "bioeffect": ["skincare", "skin care", "beauty"],
    "augustinus bader": ["skincare", "skin care", "beauty"],
    "skinceuticals": ["skincare", "skin care", "beauty"],
    "dr. barbara sturm": ["skincare", "skin care", "beauty"],
    "ilia": ["skincare", "skin care", "beauty"],
    "biossance": ["skincare", "skin care", "beauty"],
    "farmacy": ["skincare", "skin care", "beauty"],
    "fresh": ["skincare", "skin care", "beauty"],
    "origins": ["skincare", "skin care", "beauty"],
    "youth to the people": ["skincare", "skin care", "beauty"],
    "glow recipe": ["skincare", "skin care", "beauty"],
    "laneige": ["skincare", "skin care", "beauty"],
    "sulwhasoo": ["skincare", "skin care", "beauty"],
    "innisfree": ["skincare", "skin care", "beauty"],
    "cosrx": ["skincare", "skin care", "beauty"],
    # ===================
    # PERFUME / FRAGRANCE
    # ===================
    "perfume": ["perfume", "fragrance", "beauty"],
    "parfum": ["perfume", "fragrance", "beauty"],
    "eau de parfum": ["perfume", "fragrance", "beauty"],
    "eau de toilette": ["perfume", "fragrance", "beauty"],
    "cologne": ["perfume", "fragrance", "beauty"],
    "fragrance": ["perfume", "fragrance", "beauty"],
    "body spray": ["perfume", "fragrance", "beauty"],
    "scent": ["perfume", "fragrance", "beauty"],
    # Perfume brands
    "chanel no": ["perfume", "fragrance", "beauty"],
    "jo malone": ["perfume", "fragrance", "beauty"],
    "le labo": ["perfume", "fragrance", "beauty"],
    "byredo": ["perfume", "fragrance", "beauty"],
    "diptyque": ["perfume", "fragrance", "home"],
    "maison margiela replica": ["perfume", "fragrance", "beauty"],
    "tom ford": ["perfume", "fragrance", "beauty"],
    "ysl": ["perfume", "fragrance", "beauty"],
    "dior sauvage": ["perfume", "fragrance", "beauty"],
    "miss dior": ["perfume", "fragrance", "beauty"],
    "gucci bloom": ["perfume", "fragrance", "beauty"],
    "chloe": ["perfume", "fragrance", "beauty"],
    "viktor & rolf": ["perfume", "fragrance", "beauty"],
    "flowerbomb": ["perfume", "fragrance", "beauty"],
    "maison francis kurkdjian": ["perfume", "fragrance", "beauty"],
    "d.s. & durga": ["perfume", "fragrance", "beauty"],
    # ===================
    # JEWELRY
    # ===================
    "ring": ["jewelry", "jewellery", "accessories"],
    "necklace": ["jewelry", "jewellery", "accessories"],
    "bracelet": ["jewelry", "jewellery", "accessories"],
    "earring": ["jewelry", "jewellery", "accessories"],
    "earrings": ["jewelry", "jewellery", "accessories"],
    "pendant": ["jewelry", "jewellery", "accessories"],
    "chain": ["jewelry", "jewellery", "accessories"],
    "bangle": ["jewelry", "jewellery", "accessories"],
    "anklet": ["jewelry", "jewellery", "accessories"],
    "cuff": ["jewelry", "jewellery", "accessories"],
    "hoop": ["jewelry", "jewellery", "accessories"],
    "hoops": ["jewelry", "jewellery", "accessories"],
    "stud": ["jewelry", "jewellery", "accessories"],
    "studs": ["jewelry", "jewellery", "accessories"],
    "choker": ["jewelry", "jewellery", "accessories"],
    "signet": ["jewelry", "jewellery", "accessories"],
    "tennis bracelet": ["jewelry", "jewellery", "accessories"],
    "charm": ["jewelry", "jewellery", "accessories"],
    "14k gold": ["jewelry", "jewellery", "accessories"],
    "18k gold": ["jewelry", "jewellery", "accessories"],
    "sterling silver": ["jewelry", "jewellery", "accessories"],
    "vermeil": ["jewelry", "jewellery", "accessories"],
    "diamond": ["jewelry", "jewellery", "accessories"],
    # Jewelry brands
    "mejuri": ["jewelry", "jewellery", "accessories"],
    "monica vinader": ["jewelry", "jewellery", "accessories"],
    "missoma": ["jewelry", "jewellery", "accessories"],
    "gorjana": ["jewelry", "jewellery", "accessories"],
    "ana luisa": ["jewelry", "jewellery", "accessories"],
    "stone and strand": ["jewelry", "jewellery", "accessories"],
    "catbird": ["jewelry", "jewellery", "accessories"],
    "maria tash": ["jewelry", "jewellery", "accessories"],
    "david yurman": ["jewelry", "jewellery", "accessories"],
    "tiffany": ["jewelry", "jewellery", "accessories"],
    "cartier": ["jewelry", "jewellery", "accessories"],
    "pandora": ["jewelry", "jewellery", "accessories"],
    "kendra scott": ["jewelry", "jewellery", "accessories"],
    "jenny bird": ["jewelry", "jewellery", "accessories"],
    "baublebar": ["jewelry", "jewellery", "accessories"],
    # ===================
    # BAGS
    # ===================
    "bag": ["bags", "handbags", "accessories"],
    "handbag": ["bags", "handbags", "accessories"],
    "purse": ["bags", "handbags", "accessories"],
    "tote": ["bags", "handbags", "accessories"],
    "tote bag": ["bags", "handbags", "accessories"],
    "clutch": ["bags", "handbags", "accessories"],
    "crossbody": ["bags", "handbags", "accessories"],
    "shoulder bag": ["bags", "handbags", "accessories"],
    "satchel": ["bags", "handbags", "accessories"],
    "backpack": ["bags", "handbags", "accessories"],
    "mini bag": ["bags", "handbags", "accessories"],
    "bucket bag": ["bags", "handbags", "accessories"],
    "hobo bag": ["bags", "handbags", "accessories"],
    "belt bag": ["bags", "handbags", "accessories"],
    "wallet": ["bags", "accessories"],
    "card holder": ["bags", "accessories"],
    "card case": ["bags", "accessories"],
    "pouch": ["bags", "accessories"],
    # Bag brands
    "louis vuitton": ["bags", "handbags", "accessories"],
    "gucci": ["bags", "handbags", "accessories"],
    "prada": ["bags", "handbags", "accessories"],
    "celine": ["bags", "handbags", "accessories"],
    "bottega veneta": ["bags", "handbags", "accessories"],
    "loewe": ["bags", "handbags", "accessories"],
    "saint laurent": ["bags", "handbags", "accessories"],
    "balenciaga": ["bags", "handbags", "accessories"],
    "chloe": ["bags", "handbags", "accessories"],
    "coach": ["bags", "handbags", "accessories"],
    "kate spade": ["bags", "handbags", "accessories"],
    "longchamp": ["bags", "handbags", "accessories"],
    "marc jacobs": ["bags", "handbags", "accessories"],
    "polene": ["bags", "handbags", "accessories"],
    "mansur gavriel": ["bags", "handbags", "accessories"],
    "staud": ["bags", "handbags", "accessories"],
    "demellier": ["bags", "handbags", "accessories"],
    "strathberry": ["bags", "handbags", "accessories"],
    # ===================
    # SHOES
    # ===================
    "shoes": ["shoes", "footwear"],
    "boots": ["shoes", "footwear"],
    "ankle boots": ["shoes", "footwear"],
    "knee high boots": ["shoes", "footwear"],
    "sandals": ["shoes", "footwear"],
    "sneakers": ["shoes", "footwear"],
    "trainers": ["shoes", "footwear"],
    "heels": ["shoes", "footwear"],
    "pumps": ["shoes", "footwear"],
    "loafers": ["shoes", "footwear"],
    "flats": ["shoes", "footwear"],
    "ballet flats": ["shoes", "footwear"],
    "mules": ["shoes", "footwear"],
    "slides": ["shoes", "footwear"],
    "espadrilles": ["shoes", "footwear"],
    "oxfords": ["shoes", "footwear"],
    "slingback": ["shoes", "footwear"],
    "kitten heel": ["shoes", "footwear"],
    "platform": ["shoes", "footwear"],
    "wedge": ["shoes", "footwear"],
    # Shoe brands
    "manolo blahnik": ["shoes", "footwear"],
    "jimmy choo": ["shoes", "footwear"],
    "christian louboutin": ["shoes", "footwear"],
    "stuart weitzman": ["shoes", "footwear"],
    "sam edelman": ["shoes", "footwear"],
    "steve madden": ["shoes", "footwear"],
    "veja": ["shoes", "footwear"],
    "golden goose": ["shoes", "footwear"],
    "common projects": ["shoes", "footwear"],
    "new balance": ["shoes", "footwear"],
    "nike": ["shoes", "footwear"],
    "adidas": ["shoes", "footwear"],
    "gianvito rossi": ["shoes", "footwear"],
    "aquazzura": ["shoes", "footwear"],
    "aeyde": ["shoes", "footwear"],
    "by far": ["shoes", "footwear", "bags"],
    "the row": ["shoes", "footwear", "clothing"],
    # ===================
    # CLOTHING
    # ===================
    "dress": ["clothing", "clothes", "fashion"],
    "midi dress": ["clothing", "clothes", "fashion"],
    "maxi dress": ["clothing", "clothes", "fashion"],
    "mini dress": ["clothing", "clothes", "fashion"],
    "shirt": ["clothing", "clothes", "fashion"],
    "blouse": ["clothing", "clothes", "fashion"],
    "top": ["clothing", "clothes", "fashion"],
    "pants": ["clothing", "clothes", "fashion"],
    "trousers": ["clothing", "clothes", "fashion"],
    "jeans": ["clothing", "clothes", "fashion"],
    "skirt": ["clothing", "clothes", "fashion"],
    "shorts": ["clothing", "clothes", "fashion"],
    "jacket": ["clothing", "clothes", "fashion"],
    "blazer": ["clothing", "clothes", "fashion"],
    "coat": ["clothing", "clothes", "fashion"],
    "sweater": ["clothing", "clothes", "fashion"],
    "cardigan": ["clothing", "clothes", "fashion"],
    "knit": ["clothing", "clothes", "fashion"],
    "knitwear": ["clothing", "clothes", "fashion"],
    "jumpsuit": ["clothing", "clothes", "fashion"],
    "romper": ["clothing", "clothes", "fashion"],
    "bodysuit": ["clothing", "clothes", "fashion"],
    "tank top": ["clothing", "clothes", "fashion"],
    "t-shirt": ["clothing", "clothes", "fashion"],
    "tee": ["clothing", "clothes", "fashion"],
    "hoodie": ["clothing", "clothes", "fashion"],
    "sweatshirt": ["clothing", "clothes", "fashion"],
    "vest": ["clothing", "clothes", "fashion"],
    "lingerie": ["clothing", "clothes", "fashion"],
    "bra": ["clothing", "clothes", "fashion"],
    "underwear": ["clothing", "clothes", "fashion"],
    "swimsuit": ["clothing", "clothes", "fashion"],
    "bikini": ["clothing", "clothes", "fashion"],
    # Clothing brands
    "reformation": ["clothing", "clothes", "fashion"],
    "realisation par": ["clothing", "clothes", "fashion"],
    "rouje": ["clothing", "clothes", "fashion"],
    "sezane": ["clothing", "clothes", "fashion"],
    "toteme": ["clothing", "clothes", "fashion"],
    "cos": ["clothing", "clothes", "fashion"],
    "arket": ["clothing", "clothes", "fashion"],
    "& other stories": ["clothing", "clothes", "fashion"],
    "massimo dutti": ["clothing", "clothes", "fashion"],
    "aritzia": ["clothing", "clothes", "fashion"],
    "everlane": ["clothing", "clothes", "fashion"],
    "vince": ["clothing", "clothes", "fashion"],
    "theory": ["clothing", "clothes", "fashion"],
    "equipment": ["clothing", "clothes", "fashion"],
    "frame": ["clothing", "clothes", "fashion"],
    "agolde": ["clothing", "clothes", "fashion"],
    "citizens of humanity": ["clothing", "clothes", "fashion"],
    "mother denim": ["clothing", "clothes", "fashion"],
    "ganni": ["clothing", "clothes", "fashion"],
    "staud": ["clothing", "clothes", "fashion", "bags"],
    "faithfull the brand": ["clothing", "clothes", "fashion"],
    "zimmermann": ["clothing", "clothes", "fashion"],
    "ulla johnson": ["clothing", "clothes", "fashion"],
    "veronica beard": ["clothing", "clothes", "fashion"],
    "ba&sh": ["clothing", "clothes", "fashion"],
    "maje": ["clothing", "clothes", "fashion"],
    "sandro": ["clothing", "clothes", "fashion"],
    "alice + olivia": ["clothing", "clothes", "fashion"],
    # ===================
    # ACCESSORIES
    # ===================
    "scarf": ["accessories", "fashion"],
    "silk scarf": ["accessories", "fashion"],
    "hat": ["accessories", "fashion"],
    "cap": ["accessories", "fashion"],
    "beanie": ["accessories", "fashion"],
    "belt": ["accessories", "fashion"],
    "sunglasses": ["accessories", "fashion"],
    "eyeglasses": ["accessories", "fashion"],
    "watch": ["accessories", "jewelry"],
    "gloves": ["accessories", "fashion"],
    "headband": ["accessories", "fashion"],
    "hair clip": ["accessories", "fashion"],
    "hair tie": ["accessories", "fashion"],
    "barrette": ["accessories", "fashion"],
    "scrunchie": ["accessories", "fashion"],
    "keychain": ["accessories"],
    "phone case": ["accessories"],
    "tech accessories": ["accessories"],
    # ===================
    # HOME
    # ===================
    "candle": ["home", "home decor"],
    "candles": ["home", "home decor"],
    "diffuser": ["home", "home decor"],
    "room spray": ["home", "home decor"],
    "pillow": ["home", "home decor"],
    "throw pillow": ["home", "home decor"],
    "cushion": ["home", "home decor"],
    "blanket": ["home", "home decor"],
    "throw": ["home", "home decor"],
    "vase": ["home", "home decor"],
    "lamp": ["home", "home decor"],
    "rug": ["home", "home decor"],
    "frame": ["home", "home decor"],
    "picture frame": ["home", "home decor"],
    "mirror": ["home", "home decor"],
    "tray": ["home", "home decor"],
    "planter": ["home", "home decor"],
    "bedding": ["home", "home decor"],
    "sheets": ["home", "home decor"],
    "duvet": ["home", "home decor"],
    "towel": ["home", "home decor"],
    "bath towel": ["home", "home decor"],
    "coaster": ["home", "home decor"],
    "mug": ["home", "home decor"],
    "tableware": ["home", "home decor"],
    "dinnerware": ["home", "home decor"],
    # Home brands
    "cire trudon": ["home", "home decor"],
    "boy smells": ["home", "home decor"],
    "apotheke": ["home", "home decor"],
    "voluspa": ["home", "home decor"],
    "nest fragrances": ["home", "home decor"],
    "otherland": ["home", "home decor"],
    "brooklinen": ["home", "home decor"],
    "parachute home": ["home", "home decor"],
    "cb2": ["home", "home decor"],
    "west elm": ["home", "home decor"],
    # ===================
    # TRAVEL
    # ===================
    "luggage": ["travel", "bags"],
    "suitcase": ["travel", "bags"],
    "carry-on": ["travel", "bags"],
    "carry on": ["travel", "bags"],
    "duffle": ["travel", "bags"],
    "duffel": ["travel", "bags"],
    "weekender": ["travel", "bags"],
    "travel bag": ["travel", "bags"],
    "garment bag": ["travel", "bags"],
    "passport holder": ["travel", "accessories"],
    "passport cover": ["travel", "accessories"],
    "toiletry bag": ["travel", "bags"],
    "cosmetic bag": ["travel", "bags"],
    "packing cubes": ["travel"],
    "neck pillow": ["travel"],
    "travel pillow": ["travel"],
    "eye mask": ["travel"],
    "sleep mask": ["travel"],
    "travel wallet": ["travel", "accessories"],
    # Travel brands
    "away": ["travel", "bags"],
    "rimowa": ["travel", "bags"],
    "tumi": ["travel", "bags"],
    "calpak": ["travel", "bags"],
    "beis": ["travel", "bags"],
    "monos": ["travel", "bags"],
    "paravel": ["travel", "bags"],
    "july": ["travel", "bags"],
    # ===================
    # HOBBY
    # ===================
    "book": ["hobby", "books"],
    "journal": ["hobby", "stationery"],
    "notebook": ["hobby", "stationery"],
    "planner": ["hobby", "stationery"],
    "stationery": ["hobby"],
    "pen": ["hobby", "stationery"],
    "puzzle": ["hobby", "games"],
    "game": ["hobby", "games"],
    "board game": ["hobby", "games"],
    "craft": ["hobby"],
    "knitting": ["hobby"],
    "yarn": ["hobby"],
    "sewing": ["hobby"],
    "embroidery": ["hobby"],
    "paint": ["hobby", "art"],
    "canvas": ["hobby", "art"],
    "art supplies": ["hobby", "art"],
    "sketch": ["hobby", "art"],
    "camera": ["hobby", "tech"],
    "film": ["hobby"],
    "vinyl": ["hobby", "music"],
    "record": ["hobby", "music"],
    "guitar": ["hobby", "music"],
    "yoga mat": ["hobby", "fitness"],
    "fitness": ["hobby"],
    "workout": ["hobby", "fitness"],
    # ===================
    # HAIR CARE
    # ===================
    "shampoo": ["hair", "hair care", "beauty"],
    "conditioner": ["hair", "hair care", "beauty"],
    "hair oil": ["hair", "hair care", "beauty"],
    "hair mask": ["hair", "hair care", "beauty"],
    "hair serum": ["hair", "hair care", "beauty"],
    "dry shampoo": ["hair", "hair care", "beauty"],
    "hair spray": ["hair", "hair care", "beauty"],
    "styling": ["hair", "hair care", "beauty"],
    "heat protectant": ["hair", "hair care", "beauty"],
    # Hair brands
    "olaplex": ["hair", "hair care", "beauty"],
    "oribe": ["hair", "hair care", "beauty"],
    "kerastase": ["hair", "hair care", "beauty"],
    "moroccanoil": ["hair", "hair care", "beauty"],
    "bumble and bumble": ["hair", "hair care", "beauty"],
    "living proof": ["hair", "hair care", "beauty"],
    "briogeo": ["hair", "hair care", "beauty"],
    "amika": ["hair", "hair care", "beauty"],
    # ===================
    # MAKEUP
    # ===================
    "lipstick": ["makeup", "beauty", "cosmetics"],
    "lip gloss": ["makeup", "beauty", "cosmetics"],
    "lip liner": ["makeup", "beauty", "cosmetics"],
    "mascara": ["makeup", "beauty", "cosmetics"],
    "foundation": ["makeup", "beauty", "cosmetics"],
    "concealer": ["makeup", "beauty", "cosmetics"],
    "eyeshadow": ["makeup", "beauty", "cosmetics"],
    "eye shadow": ["makeup", "beauty", "cosmetics"],
    "blush": ["makeup", "beauty", "cosmetics"],
    "bronzer": ["makeup", "beauty", "cosmetics"],
    "primer": ["makeup", "beauty", "cosmetics"],
    "eyeliner": ["makeup", "beauty", "cosmetics"],
    "highlighter": ["makeup", "beauty", "cosmetics"],
    "contour": ["makeup", "beauty", "cosmetics"],
    "setting powder": ["makeup", "beauty", "cosmetics"],
    "setting spray": ["makeup", "beauty", "cosmetics"],
    "brow": ["makeup", "beauty", "cosmetics"],
    "eyebrow": ["makeup", "beauty", "cosmetics"],
    "lash": ["makeup", "beauty", "cosmetics"],
    "nail polish": ["makeup", "beauty", "cosmetics"],
    # Makeup brands
    "charlotte tilbury": ["makeup", "beauty", "cosmetics"],
    "nars": ["makeup", "beauty", "cosmetics"],
    "mac": ["makeup", "beauty", "cosmetics"],
    "bobbi brown": ["makeup", "beauty", "cosmetics"],
    "urban decay": ["makeup", "beauty", "cosmetics"],
    "too faced": ["makeup", "beauty", "cosmetics"],
    "benefit": ["makeup", "beauty", "cosmetics"],
    "fenty beauty": ["makeup", "beauty", "cosmetics"],
    "rare beauty": ["makeup", "beauty", "cosmetics"],
    "merit": ["makeup", "beauty", "cosmetics"],
    "kosas": ["makeup", "beauty", "cosmetics"],
    "westman atelier": ["makeup", "beauty", "cosmetics"],
    "pat mcgrath": ["makeup", "beauty", "cosmetics"],
    "hourglass": ["makeup", "beauty", "cosmetics"],
    "laura mercier": ["makeup", "beauty", "cosmetics"],
}


def _find_keywords_in_text(text: str) -> set[str]:
    """Find product keywords in text that map to categories."""
    text_lower = text.lower()
    found: set[str] = set()
    # Check multi-word keywords first (longer matches take priority)
    keywords: list[str] = list(KEYWORD_TO_CATEGORY.keys())
    keywords.sort(key=len, reverse=True)
    for keyword in keywords:
        if keyword in text_lower:
            found.add(keyword)
    return found


def suggest_categories_by_keywords(
    session: Session,
    user_id: uuid.UUID,
    title: str | None,
    description: str | None = None,
    limit: int = 5,
) -> list[CategorySuggestion]:
    """Suggest categories by matching product keywords to category names.

    Uses a keyword → category mapping to infer categories from product text.
    E.g., "serum" in title → suggest user's "Skincare" category.

    This works even without user history (cold start).
    """
    text = f"{title or ''} {description or ''}".strip()
    if not text:
        return []

    categories = _get_user_categories(session, user_id)
    if not categories:
        return []

    # Find keywords in product text
    found_keywords = _find_keywords_in_text(text)
    if not found_keywords:
        return []

    # Collect target category names from keywords
    target_names: set[str] = set()
    for keyword in found_keywords:
        target_names.update(KEYWORD_TO_CATEGORY.get(keyword, []))

    # Match against user's categories
    suggestions = []
    for category in categories:
        cat_name_lower = category.name.lower()
        # Exact match
        if cat_name_lower in target_names:
            suggestions.append(
                CategorySuggestion(
                    category_id=category.id,
                    category_name=category.name,
                    confidence=0.85,
                    source="keyword_inference",
                )
            )
            continue
        # Partial match (target name contained in category name or vice versa)
        for target in target_names:
            if target in cat_name_lower or cat_name_lower in target:
                suggestions.append(
                    CategorySuggestion(
                        category_id=category.id,
                        category_name=category.name,
                        confidence=0.75,
                        source="keyword_inference",
                    )
                )
                break

    suggestions.sort(key=lambda s: s.confidence, reverse=True)
    return suggestions[:limit]


def suggest_categories_by_domain(
    session: Session,
    user_id: uuid.UUID,
    product_url: str,
    limit: int = 5,
) -> list[CategorySuggestion]:
    """Suggest categories based on what the user has assigned to items from this domain.

    Looks at historical categorization patterns: if 80% of Sephora items are
    categorized as "Skincare", suggest "Skincare" with high confidence.
    """
    target_domain = _extract_domain(product_url)
    if not target_domain:
        return []

    items_with_categories = _get_user_items_with_categories(session, user_id)

    # Count category assignments for items from the same domain
    category_counts: Counter[uuid.UUID] = Counter()
    domain_item_count = 0

    for item, categories in items_with_categories:
        if not item.product_url:
            continue

        item_domain = _extract_domain(item.product_url)
        if item_domain == target_domain:
            domain_item_count += 1
            for category in categories:
                category_counts[category.id] += 1

    if domain_item_count == 0:
        return []

    # Calculate confidence as proportion of domain items with this category
    suggestions = []
    for category_id, count in category_counts.most_common(limit):
        confidence = count / domain_item_count
        # Only suggest if at least 20% of items from domain have this category
        if confidence >= 0.2:
            # Get category name
            category = session.get(Category, category_id)
            if category:
                suggestions.append(
                    CategorySuggestion(
                        category_id=category_id,
                        category_name=category.name,
                        confidence=confidence,
                        source="domain_history",
                    )
                )

    return suggestions


def suggest_categories_by_title(
    session: Session,
    user_id: uuid.UUID,
    title: str,
    limit: int = 5,
) -> list[CategorySuggestion]:
    """Suggest categories by matching title words to category names.

    Simple but effective: if the title contains "ring" and user has "Jewelry"
    category, suggest it. Also matches partial words (e.g., "skincare" in title
    matches "Skincare" category).
    """
    if not title:
        return []

    categories = _get_user_categories(session, user_id)
    if not categories:
        return []

    title_words = _normalize_text(title)
    title_lower = title.lower()

    suggestions = []
    for category in categories:
        category_name_lower = category.name.lower()
        category_words = _normalize_text(category.name)

        # Exact word match (category name is a word in title)
        if category_name_lower in title_words:
            suggestions.append(
                CategorySuggestion(
                    category_id=category.id,
                    category_name=category.name,
                    confidence=0.9,
                    source="title_match",
                )
            )
            continue

        # Substring match (category name appears anywhere in title)
        if category_name_lower in title_lower:
            suggestions.append(
                CategorySuggestion(
                    category_id=category.id,
                    category_name=category.name,
                    confidence=0.8,
                    source="title_match",
                )
            )
            continue

        # Word overlap (any word from category matches title words)
        overlap = category_words & title_words
        if overlap:
            confidence = len(overlap) / len(category_words) * 0.7
            suggestions.append(
                CategorySuggestion(
                    category_id=category.id,
                    category_name=category.name,
                    confidence=confidence,
                    source="title_match",
                )
            )

    # Sort by confidence and limit
    suggestions.sort(key=lambda s: s.confidence, reverse=True)
    return suggestions[:limit]


def suggest_categories_by_breadcrumbs(
    session: Session,
    user_id: uuid.UUID,
    breadcrumbs: list[str],
    limit: int = 5,
) -> list[CategorySuggestion]:
    """Suggest categories by matching breadcrumbs to category names.

    Breadcrumbs from structured data often contain category-like strings.
    E.g., ["Skincare", "Moisturizers"] could match "Skincare" category.
    """
    if not breadcrumbs:
        return []

    categories = _get_user_categories(session, user_id)
    if not categories:
        return []

    # Normalize breadcrumbs
    breadcrumb_set = {b.lower().strip() for b in breadcrumbs}
    breadcrumb_words = set()
    for b in breadcrumbs:
        breadcrumb_words.update(_normalize_text(b))

    suggestions = []
    for category in categories:
        category_name_lower = category.name.lower()
        category_words = _normalize_text(category.name)

        # Exact breadcrumb match
        if category_name_lower in breadcrumb_set:
            suggestions.append(
                CategorySuggestion(
                    category_id=category.id,
                    category_name=category.name,
                    confidence=0.95,
                    source="breadcrumb_match",
                )
            )
            continue

        # Substring match (category name appears in any breadcrumb)
        for breadcrumb in breadcrumbs:
            if category_name_lower in breadcrumb.lower():
                suggestions.append(
                    CategorySuggestion(
                        category_id=category.id,
                        category_name=category.name,
                        confidence=0.85,
                        source="breadcrumb_match",
                    )
                )
                break

        # Word overlap
        overlap = category_words & breadcrumb_words
        if overlap:
            confidence = len(overlap) / len(category_words) * 0.7
            suggestions.append(
                CategorySuggestion(
                    category_id=category.id,
                    category_name=category.name,
                    confidence=confidence,
                    source="breadcrumb_match",
                )
            )

    # Sort by confidence and limit
    suggestions.sort(key=lambda s: s.confidence, reverse=True)
    return suggestions[:limit]


def suggest_categories_by_brand(
    session: Session,
    user_id: uuid.UUID,
    brand: str,
    limit: int = 5,
) -> list[CategorySuggestion]:
    """Suggest categories based on what categories the user assigns to this brand.

    If user consistently categorizes "Mejuri" items as "Jewelry", suggest that.
    """
    if not brand:
        return []

    brand_lower = brand.lower().strip()
    items_with_categories = _get_user_items_with_categories(session, user_id)

    # Count category assignments for items with matching brand in title
    category_counts: Counter[uuid.UUID] = Counter()
    brand_item_count = 0

    for item, categories in items_with_categories:
        if brand_lower in item.title.lower():
            brand_item_count += 1
            for category in categories:
                category_counts[category.id] += 1

    if brand_item_count == 0:
        return []

    suggestions = []
    for category_id, count in category_counts.most_common(limit):
        confidence = count / brand_item_count
        if confidence >= 0.2:
            category = session.get(Category, category_id)
            if category:
                suggestions.append(
                    CategorySuggestion(
                        category_id=category_id,
                        category_name=category.name,
                        confidence=confidence,
                        source="brand_history",
                    )
                )

    return suggestions


@dataclass
class SuggestionInput:
    """Input for category suggestion."""

    product_url: str | None = None
    title: str | None = None
    breadcrumbs: list[str] | None = None
    brand: str | None = None
    category: str | None = None  # From structured data


def suggest_categories(
    session: Session,
    user_id: uuid.UUID,
    input_data: SuggestionInput,
    threshold: float = 0.3,
    limit: int = 5,
) -> list[CategorySuggestion]:
    """Suggest categories using all available strategies.

    Combines results from all strategies, deduplicates by category,
    and returns the highest-confidence suggestion for each category.
    """
    all_suggestions: list[CategorySuggestion] = []

    # Strategy 1: Domain history (strongest signal)
    if input_data.product_url:
        all_suggestions.extend(
            suggest_categories_by_domain(session, user_id, input_data.product_url)
        )

    # Strategy 2: Breadcrumb matching (very reliable when present)
    if input_data.breadcrumbs:
        all_suggestions.extend(
            suggest_categories_by_breadcrumbs(session, user_id, input_data.breadcrumbs)
        )

    # Strategy 3: Title matching
    if input_data.title:
        all_suggestions.extend(
            suggest_categories_by_title(session, user_id, input_data.title)
        )

    # Strategy 4: Brand history
    if input_data.brand:
        all_suggestions.extend(
            suggest_categories_by_brand(session, user_id, input_data.brand)
        )

    # Strategy 5: Direct category from structured data
    if input_data.category:
        # Try to match structured data category to user's categories
        categories = _get_user_categories(session, user_id)
        category_lower = input_data.category.lower()
        for cat in categories:
            if cat.name.lower() == category_lower or category_lower in cat.name.lower():
                all_suggestions.append(
                    CategorySuggestion(
                        category_id=cat.id,
                        category_name=cat.name,
                        confidence=0.9,
                        source="structured_data",
                    )
                )
                break

    # Strategy 6: Keyword inference (cold start - works without user history)
    if input_data.title:
        all_suggestions.extend(
            suggest_categories_by_keywords(session, user_id, input_data.title)
        )

    # Deduplicate: keep highest confidence per category
    best_by_category: dict[uuid.UUID, CategorySuggestion] = {}
    for suggestion in all_suggestions:
        existing = best_by_category.get(suggestion.category_id)
        if existing is None or suggestion.confidence > existing.confidence:
            best_by_category[suggestion.category_id] = suggestion

    # Filter by threshold and sort
    results = [s for s in best_by_category.values() if s.confidence >= threshold]
    results.sort(key=lambda s: s.confidence, reverse=True)

    return results[:limit]
