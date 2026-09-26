"""Models for URL parsing feature."""

from typing import NamedTuple, Protocol

from pydantic import BaseModel, HttpUrl


class FetchResult(NamedTuple):
    """Raw page content plus the URL it was actually served from.

    `final_url` is what the request landed on after redirects. It is the
    signal price tracking uses to notice that a product link now points
    somewhere else (a category listing, a homepage, a replacement product).
    """

    html: str
    final_url: str


class ProductMetadata(BaseModel):
    """Extracted product metadata from a URL."""

    title: str | None = None
    description: str | None = None
    image_url: str | None = None
    price_cents: int | None = None
    currency: str | None = None
    source_url: str
    # URL the page was actually served from, after redirects.
    final_url: str | None = None
    # Category extraction from structured data
    brand: str | None = None
    category: str | None = None
    breadcrumbs: list[str] | None = None

    def is_complete(self) -> bool:
        """Check if we have the essential fields for a wishlist item."""
        return self.title is not None and self.price_cents is not None


class ExtractionStrategy(Protocol):
    """Protocol for product metadata extraction strategies.

    Strategies are tried in priority order until one returns complete data.
    Each strategy extracts from a specific structured data format.
    """

    @property
    def name(self) -> str:
        """Human-readable name for logging."""
        ...

    def extract(self, html: str, base_url: str) -> ProductMetadata | None:
        """Extract product metadata from HTML.

        Args:
            html: Raw HTML content of the page.
            base_url: The URL of the page (for resolving relative URLs).

        Returns:
            ProductMetadata if extraction succeeded, None if this strategy
            couldn't find relevant data.
        """
        ...


class ParseUrlRequest(BaseModel):
    """Request body for URL parsing endpoint."""

    url: HttpUrl


class ParseUrlResponse(BaseModel):
    """Response from URL parsing endpoint."""

    title: str | None = None
    description: str | None = None
    image_url: str | None = None
    price_cents: int | None = None
    currency: str | None = None
    source_url: str
    final_url: str | None = None
    extraction_method: str | None = None
    # Category extraction from structured data
    brand: str | None = None
    category: str | None = None
    breadcrumbs: list[str] | None = None
