"""Extraction strategies for different structured data formats."""

import re
from decimal import Decimal, InvalidOperation

import extruct

from app.features.url_parser.models import ProductMetadata


def parse_price_to_cents(
    price_str: str | None, currency: str | None = None
) -> tuple[int | None, str | None]:
    """Parse a price string to cents and currency.

    Handles formats like:
    - "68.00"
    - "$68.00"
    - "68"
    - "1,299.99"

    Returns:
        Tuple of (price_cents, currency_code).
    """
    if not price_str:
        return None, currency

    # Remove currency symbols and whitespace
    cleaned = re.sub(r"[£€¥$\s,]", "", str(price_str))

    # Extract numeric part
    match = re.search(r"(\d+(?:\.\d{1,2})?)", cleaned)
    if not match:
        return None, currency

    try:
        price_decimal = Decimal(match.group(1))
        price_cents = int(price_decimal * 100)
        return price_cents, currency
    except InvalidOperation:
        return None, currency


class JsonLdStrategy:
    """Extract product metadata from JSON-LD structured data.

    JSON-LD is Google's preferred format for SEO and provides
    the most reliable structured product data.
    """

    @property
    def name(self) -> str:
        return "json-ld"

    def extract(self, html: str, base_url: str) -> ProductMetadata | None:
        """Extract from JSON-LD Product or ProductGroup schema."""
        data = extruct.extract(html, base_url=base_url, syntaxes=["json-ld"])

        # First, extract breadcrumbs (available separately from Product)
        breadcrumbs = self._extract_breadcrumbs(data.get("json-ld", []))

        for item in data.get("json-ld", []):
            if not isinstance(item, dict):
                continue

            # Handle @graph structure (contains array of objects)
            if "@graph" in item:
                for graph_item in item.get("@graph", []):
                    result = self._try_extract_item(graph_item, base_url)
                    if result:
                        # Merge breadcrumbs into result
                        if breadcrumbs and not result.breadcrumbs:
                            result.breadcrumbs = breadcrumbs
                            result.category = breadcrumbs[0] if breadcrumbs else None
                        return result
                continue

            result = self._try_extract_item(item, base_url)
            if result:
                # Merge breadcrumbs into result
                if breadcrumbs and not result.breadcrumbs:
                    result.breadcrumbs = breadcrumbs
                    result.category = breadcrumbs[0] if breadcrumbs else None
                return result

        return None

    def _extract_breadcrumbs(self, json_ld_items: list) -> list[str] | None:
        """Extract and normalize breadcrumbs from BreadcrumbList schema."""
        for item in json_ld_items:
            if not isinstance(item, dict):
                continue

            # Handle @graph structure
            if "@graph" in item:
                for graph_item in item.get("@graph", []):
                    breadcrumbs = self._try_extract_breadcrumb_list(graph_item)
                    if breadcrumbs:
                        return breadcrumbs
                continue

            breadcrumbs = self._try_extract_breadcrumb_list(item)
            if breadcrumbs:
                return breadcrumbs

        return None

    def _try_extract_breadcrumb_list(self, item: dict) -> list[str] | None:
        """Try to extract breadcrumbs from a BreadcrumbList item."""
        item_type = item.get("@type")
        if item_type != "BreadcrumbList":
            return None

        elements = item.get("itemListElement", [])
        if not elements:
            return None

        # Sort by position and extract names
        sorted_elements = sorted(
            [e for e in elements if isinstance(e, dict)],
            key=lambda x: x.get("position", 0),
        )

        raw_crumbs = [
            e.get("name")
            or (
                e.get("item", {}).get("name")
                if isinstance(e.get("item"), dict)
                else None
            )
            for e in sorted_elements
        ]
        raw_crumbs = [c for c in raw_crumbs if c]

        # Normalize: remove Home, Brands, Sale prefixes; skip product name at end
        normalized = self._normalize_breadcrumbs(raw_crumbs)
        return normalized if normalized else None

    def _normalize_breadcrumbs(self, crumbs: list[str]) -> list[str]:
        """Normalize breadcrumb path by removing noise."""
        # Skip prefixes
        skip_prefixes = {"home", "brands", "sale", "shop", "all", "new"}
        # Skip if it looks like a product name (last item often is)
        result = []

        for i, crumb in enumerate(crumbs):
            crumb_lower = crumb.lower().strip()

            # Skip common navigation prefixes
            if crumb_lower in skip_prefixes:
                continue

            # Skip paths containing "brands" (brand navigation, not category)
            if "brand" in crumb_lower:
                continue

            # Skip broken/translation errors
            if "translation missing" in crumb_lower:
                continue

            # Skip the last item if it looks like a product name (>30 chars or contains specific keywords)
            if i == len(crumbs) - 1 and (
                len(crumb) > 30
                or any(c in crumb_lower for c in ["ml", "oz", "g ", "pack"])
            ):
                continue

            # Normalize to title case
            result.append(crumb.strip().title())

        return result

    def _try_extract_item(self, item: dict, base_url: str) -> ProductMetadata | None:
        """Try to extract product data from a single JSON-LD item."""
        if not isinstance(item, dict):
            return None

        item_type = item.get("@type")

        # Handle ProductGroup (used by Net-a-Porter, etc.)
        if item_type == "ProductGroup":
            return self._extract_from_product_group(item, base_url)

        # Handle standard Product type
        is_product = item_type == "Product" or (
            isinstance(item_type, list) and "Product" in item_type
        )
        if is_product:
            return self._extract_from_product(item, base_url)

        return None

    def _extract_from_product_group(
        self, group: dict, base_url: str
    ) -> ProductMetadata:
        """Extract metadata from a JSON-LD ProductGroup object.

        ProductGroup contains hasVariant with Product objects.
        """
        title = group.get("name")
        description = group.get("description")

        # Try to get image from the group or first variant
        image_url = self._extract_image(group.get("image"))

        # Extract brand
        brand = self._extract_brand(group.get("brand"))

        # Extract category (direct field)
        category = self._extract_category(group.get("category"))

        # Try to get price and image from variants
        price_cents, currency = None, None
        variants = group.get("hasVariant", [])
        for variant in variants:
            if isinstance(variant, dict):
                # Try to get image from variant if not found yet
                if not image_url:
                    image_url = self._extract_image(variant.get("image"))

                # Try to get price from variant's offers
                if price_cents is None:
                    price_cents, currency = self._extract_price(variant.get("offers"))

                # Stop if we have both
                if image_url and price_cents is not None:
                    break

        return ProductMetadata(
            title=title,
            description=description,
            image_url=image_url,
            price_cents=price_cents,
            currency=currency,
            source_url=base_url,
            brand=brand,
            category=category,
        )

    def _extract_from_product(self, product: dict, base_url: str) -> ProductMetadata:
        """Extract metadata from a JSON-LD Product object."""
        # Title: prefer isVariantOf.name (product name) over name (variant name)
        title = None
        if "isVariantOf" in product and isinstance(product["isVariantOf"], dict):
            title = product["isVariantOf"].get("name")
        if not title:
            title = product.get("name")

        # Description
        description = product.get("description")

        # Image - can be string or object with @id/url
        image_url = self._extract_image(product.get("image"))

        # Price from offers
        price_cents, currency = self._extract_price(product.get("offers"))

        # Brand - check product directly or isVariantOf
        brand = self._extract_brand(product.get("brand"))
        if (
            not brand
            and "isVariantOf" in product
            and isinstance(product["isVariantOf"], dict)
        ):
            brand = self._extract_brand(product["isVariantOf"].get("brand"))

        # Category - check product directly or isVariantOf
        category = self._extract_category(product.get("category"))
        if (
            not category
            and "isVariantOf" in product
            and isinstance(product["isVariantOf"], dict)
        ):
            category = self._extract_category(product["isVariantOf"].get("category"))

        return ProductMetadata(
            title=title,
            description=description,
            image_url=image_url,
            price_cents=price_cents,
            currency=currency,
            source_url=base_url,
            brand=brand,
            category=category,
        )

    def _extract_image(self, image_data: str | dict | list | None) -> str | None:
        """Extract image URL from various JSON-LD image formats."""
        if not image_data:
            return None

        if isinstance(image_data, str):
            return image_data

        if isinstance(image_data, list) and image_data:
            return self._extract_image(image_data[0])

        if isinstance(image_data, dict):
            return image_data.get("url") or image_data.get("@id")

        return None

    def _extract_brand(self, brand_data: str | dict | None) -> str | None:
        """Extract brand name from various JSON-LD brand formats."""
        if not brand_data:
            return None

        if isinstance(brand_data, str):
            return brand_data

        if isinstance(brand_data, dict):
            return brand_data.get("name")

        return None

    def _extract_category(self, category_data: str | list | None) -> str | None:
        """Extract primary category from JSON-LD category field."""
        if not category_data:
            return None

        if isinstance(category_data, str):
            return category_data

        if isinstance(category_data, list) and category_data:
            # Return first category if list
            first = category_data[0]
            if isinstance(first, str):
                return first
            if isinstance(first, dict):
                return first.get("name")

        return None

    def _extract_price(
        self, offers: dict | list | None
    ) -> tuple[int | None, str | None]:
        """Extract price from JSON-LD Offer object."""
        if not offers:
            return None, None

        # Handle list of offers (take first)
        if isinstance(offers, list):
            offers = offers[0] if offers else {}

        if not isinstance(offers, dict):
            return None, None

        # Try direct price fields first
        price_str = (
            offers.get("price") or offers.get("salePrice") or offers.get("lowPrice")
        )
        currency = offers.get("priceCurrency")

        # Try priceSpecification if direct price not found (used by some sites)
        if not price_str:
            price_spec = offers.get("priceSpecification")
            if price_spec:
                if isinstance(price_spec, list):
                    price_spec = price_spec[0] if price_spec else {}
                if isinstance(price_spec, dict):
                    price_str = price_spec.get("price")
                    currency = currency or price_spec.get("priceCurrency")

        return parse_price_to_cents(str(price_str) if price_str else None, currency)


class OpenGraphStrategy:
    """Extract product metadata from OpenGraph meta tags.

    OpenGraph is used for social sharing and is widely supported.
    Good fallback when JSON-LD is missing or incomplete.
    """

    @property
    def name(self) -> str:
        return "opengraph"

    def extract(self, html: str, base_url: str) -> ProductMetadata | None:
        """Extract from OpenGraph meta tags."""
        data = extruct.extract(html, base_url=base_url, syntaxes=["opengraph"])

        og_list = data.get("opengraph", [])
        if not og_list:
            return None

        # OpenGraph returns list of property tuples
        og_data = og_list[0] if og_list else {}
        properties = og_data.get("properties", [])

        if not properties:
            return None

        # Convert to dict for easier access
        og_dict = {}
        for key, value in properties:
            og_dict[key] = value

        # Only return if we have at least a title
        # Note: some sites use og:titles (typo) instead of og:title
        title = og_dict.get("og:title") or og_dict.get("og:titles")
        if not title:
            return None

        # Clean up title if it has site suffix (e.g., "Product | NET-A-PORTER")
        if " | " in title:
            title = title.split(" | ")[0].strip()

        # Try to get price (not standard OG, but some sites use it)
        price_str = og_dict.get("og:price:amount") or og_dict.get(
            "product:price:amount"
        )
        currency = og_dict.get("og:price:currency") or og_dict.get(
            "product:price:currency"
        )
        price_cents, currency = parse_price_to_cents(price_str, currency)

        return ProductMetadata(
            title=title,
            description=og_dict.get("og:description"),
            image_url=og_dict.get("og:image"),
            price_cents=price_cents,
            currency=currency,
            source_url=base_url,
        )


class MicrodataStrategy:
    """Extract product metadata from HTML Microdata.

    Older format, less common but still used by some sites.
    """

    @property
    def name(self) -> str:
        return "microdata"

    def extract(self, html: str, base_url: str) -> ProductMetadata | None:
        """Extract from Microdata attributes."""
        data = extruct.extract(html, base_url=base_url, syntaxes=["microdata"])

        for item in data.get("microdata", []):
            if not isinstance(item, dict):
                continue

            item_type = item.get("type")
            # Microdata uses full schema.org URLs
            if item_type and "Product" in str(item_type):
                return self._extract_from_product(item, base_url)

        return None

    def _extract_from_product(self, product: dict, base_url: str) -> ProductMetadata:
        """Extract metadata from Microdata Product."""
        props = product.get("properties", {})

        title = props.get("name")
        if isinstance(title, list):
            title = title[0] if title else None

        description = props.get("description")
        if isinstance(description, list):
            description = description[0] if description else None

        image_url = props.get("image")
        if isinstance(image_url, list):
            image_url = image_url[0] if image_url else None

        # Price from offers
        price_cents, currency = None, None
        offers = props.get("offers")
        if offers:
            if isinstance(offers, list):
                offers = offers[0]
            if isinstance(offers, dict):
                offer_props = offers.get("properties", {})
                price_str = offer_props.get("price")
                if isinstance(price_str, list):
                    price_str = price_str[0]
                currency = offer_props.get("priceCurrency")
                if isinstance(currency, list):
                    currency = currency[0]
                price_cents, currency = parse_price_to_cents(price_str, currency)

        return ProductMetadata(
            title=title,
            description=description,
            image_url=image_url,
            price_cents=price_cents,
            currency=currency,
            source_url=base_url,
        )


class EmbeddedJsonStrategy:
    """Extract product metadata from embedded JavaScript JSON.

    Some sites embed product data in script tags or JavaScript variables
    rather than using structured data formats. This strategy looks for
    common patterns like sellingPrice, fullPrice, productPrice, etc.

    Used as a fallback to extract price when other strategies fail.
    """

    @property
    def name(self) -> str:
        return "embedded-json"

    def extract(self, html: str, base_url: str) -> ProductMetadata | None:
        """Extract price from embedded JSON patterns."""
        price_cents = self._extract_price(html)

        if price_cents is None:
            return None

        # This strategy only extracts price, not other fields
        return ProductMetadata(
            title=None,
            description=None,
            image_url=None,
            price_cents=price_cents,
            currency="USD",  # Assume USD for US e-commerce sites
            source_url=base_url,
        )

    def _extract_price(self, html: str) -> int | None:
        """Extract price from various embedded JSON patterns."""
        # Pattern 1: sellingPrice.amount (Net-a-Porter style, in cents)
        match = re.search(r'"sellingPrice"\s*:\s*\{[^}]*"amount"\s*:\s*(\d+)', html)
        if match:
            return int(match.group(1))

        # Pattern 2: fullPrice.amount
        match = re.search(r'"fullPrice"\s*:\s*\{[^}]*"amount"\s*:\s*(\d+)', html)
        if match:
            return int(match.group(1))

        # Pattern 3: price as cents directly
        match = re.search(r'"priceCents"\s*:\s*(\d+)', html)
        if match:
            return int(match.group(1))

        # Pattern 4: price as decimal string (convert to cents)
        match = re.search(r'"price"\s*:\s*"?(\d+\.?\d*)"?', html)
        if match:
            try:
                price = float(match.group(1))
                # If price looks like cents (>1000 for items over $10), use as is
                # Otherwise convert from dollars
                if price > 1000:
                    return int(price)
                return int(price * 100)
            except ValueError:
                pass

        return None


class HtmlFallbackStrategy:
    """Extract product metadata from basic HTML when structured data is missing.

    Last resort for sites like Amazon that don't use JSON-LD, OpenGraph,
    or Microdata. Extracts from:
    - <title> tag (cleaned of site suffixes)
    - <meta name="description">
    - Common price patterns (priceAmount, etc.)
    - Common image patterns (hiRes, etc.)
    """

    @property
    def name(self) -> str:
        return "html-fallback"

    def extract(self, html: str, base_url: str) -> ProductMetadata | None:
        """Extract from basic HTML elements."""
        title = self._extract_title(html)
        price_cents = self._extract_price(html)

        # Only return if we have at least title or price
        if not title and price_cents is None:
            return None

        return ProductMetadata(
            title=title,
            description=self._extract_description(html),
            image_url=self._extract_image(html),
            price_cents=price_cents,
            currency="USD",  # Assume USD for US sites
            source_url=base_url,
        )

    def _extract_title(self, html: str) -> str | None:
        """Extract and clean title from <title> tag."""
        match = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
        if not match:
            return None

        title = match.group(1).strip()

        # Decode HTML entities
        title = title.replace("&amp;", "&")
        title = title.replace("&quot;", '"')
        title = title.replace("&#39;", "'")
        title = title.replace("&lt;", "<")
        title = title.replace("&gt;", ">")

        # Remove common site suffixes (e.g., " | Amazon.com", " - Site Name")
        for separator in [" | ", " - ", " : ", " – ", " — "]:
            if separator in title:
                # Keep the part before the last separator (usually product name)
                parts = title.rsplit(separator, 1)
                # Only use the first part if it looks substantial
                if len(parts[0]) > 10:
                    title = parts[0].strip()

        return title if title else None

    def _extract_description(self, html: str) -> str | None:
        """Extract from <meta name='description'>."""
        match = re.search(
            r'<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']+)["\']',
            html,
            re.IGNORECASE,
        )
        if match:
            desc = match.group(1).strip()
            desc = desc.replace("&amp;", "&")
            return desc if desc else None
        return None

    def _extract_price(self, html: str) -> int | None:
        """Extract price from common embedded patterns."""
        # Pattern 1: priceAmount (Amazon)
        match = re.search(r'priceAmount["\':]+\s*([0-9.]+)', html)
        if match:
            try:
                return int(float(match.group(1)) * 100)
            except ValueError:
                pass

        # Pattern 2: data-price attribute
        match = re.search(r'data-price=["\']([0-9.]+)["\']', html)
        if match:
            try:
                return int(float(match.group(1)) * 100)
            except ValueError:
                pass

        return None

    def _extract_image(self, html: str) -> str | None:
        """Extract main product image from common patterns."""
        # Pattern 1: hiRes in JSON (Amazon)
        match = re.search(r'"hiRes"\s*:\s*"([^"]+)"', html)
        if match:
            return match.group(1)

        # Pattern 2: large in JSON
        match = re.search(r'"large"\s*:\s*"([^"]+)"', html)
        if match:
            return match.group(1)

        # Pattern 3: landingImage src (Amazon)
        match = re.search(r'id="landingImage"[^>]*src="([^"]+)"', html)
        if match:
            return match.group(1)

        return None
