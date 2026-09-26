"""Is the page we just fetched still the item we are tracking?

A product link can rot in ways that still return HTTP 200: the store
redirects a discontinued product to its category listing, to the homepage,
or to a replacement product. Extraction then happily reads *a* price off
that page - usually the first product in a grid - and without this check
that price would overwrite the item's own.

So a fetched price is only trusted when we can still recognise the product:
the link did not wander off to another page, and the page's title still
looks like the thing we are tracking. Anything else is reported as a
failure with a reason the UI can act on ("Link moved") instead of being
silently written to the item.
"""

import re
from typing import NamedTuple
from urllib.parse import urlparse

from app.features.price_tracking.models import PriceCheckFailureReason

# How alike two titles have to look. Similarity is the share of the shorter
# title's words that also appear in the longer one, so "Kensington Ring" vs
# "Kensington Ring | Mejuri" scores 1.0.
SAME_PRODUCT_RATIO = 0.6  # enough to accept a page the link redirected to
DIFFERENT_PRODUCT_RATIO = 0.34  # below this the page is something else
# The item's own title is weak evidence - owners rename items ("ring for mum").
# On its own it only convicts a page that has nothing in common with it.
WEAK_EVIDENCE_RATIO = 0.2

# Words that say nothing about which product a page is.
_STOPWORDS = {
    "a",
    "an",
    "and",
    "buy",
    "by",
    "com",
    "for",
    "in",
    "of",
    "official",
    "online",
    "or",
    "shop",
    "store",
    "the",
    "to",
    "with",
}

# Path segments that mean "a page listing many products", never one product.
_LISTING_SEGMENTS = {
    "c",
    "cat",
    "catalog",
    "catalogue",
    "categories",
    "category",
    "collection",
    "collections",
    "search",
    "browse",
    "results",
}

# Segments that mark the path as pointing at one specific product.
_PRODUCT_SEGMENTS = {
    "dp",
    "gp",
    "item",
    "items",
    "p",
    "prod",
    "product",
    "products",
    "sku",
}

# Leading path segments that are just locale/market routing.
_LOCALE_RE = re.compile(r"^[a-z]{2}([-_][a-z]{2})?$")


class IdentityVerdict(NamedTuple):
    """Whether a fetched page still belongs to the tracked item."""

    ok: bool
    reason: PriceCheckFailureReason | None = None
    detail: str | None = None


def _tokens(text: str | None) -> set[str]:
    """Comparable words of a title: lowercase, no punctuation, no filler."""
    if not text:
        return set()
    words = re.split(r"[^a-z0-9]+", text.lower())
    return {w for w in words if len(w) > 1 and w not in _STOPWORDS}


def title_similarity(a: str | None, b: str | None) -> float | None:
    """0..1 overlap of two titles, or None when either has no usable words."""
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return None
    return len(ta & tb) / min(len(ta), len(tb))


def _path_segments(url: str | None) -> list[str]:
    if not url:
        return []
    path = urlparse(url).path.lower()
    segments = [s for s in path.split("/") if s]
    # Market routing ("/us/en/...") is not part of a product's identity.
    while segments and _LOCALE_RE.match(segments[0]):
        segments = segments[1:]
    if segments:
        segments[-1] = re.sub(r"\.(html?|php|aspx?)$", "", segments[-1])
    return segments


def slug_text(url: str | None) -> str | None:
    """The product slug in a URL, as readable words.

    "…/products/kensington-ring-14k" -> "kensington ring 14k". This is a
    second opinion on identity for items the owner has renamed.
    """
    segments = _path_segments(url)
    if not segments:
        return None
    slug = segments[-1]
    if slug.isdigit() and len(segments) > 1:
        slug = segments[-2]
    words = [w for w in re.split(r"[-_]+", slug) if w and not w.isdigit()]
    return " ".join(words) if words else None


def _host(url: str | None) -> str:
    if not url:
        return ""
    return urlparse(url).netloc.lower().removeprefix("www.")


def is_listing_url(url: str | None) -> bool:
    """True for homepages and pages that list many products."""
    segments = _path_segments(url)
    if not segments:
        return True
    if segments[-1] in _LISTING_SEGMENTS:
        return True
    if any(s in _PRODUCT_SEGMENTS for s in segments):
        return False
    return any(s in _LISTING_SEGMENTS for s in segments[:-1])


def landed_elsewhere(requested_url: str, final_url: str | None) -> bool:
    """Did the request end up on a different page than the one we asked for?

    Host and path only - query strings and fragments routinely change on
    their own (session ids, variant selectors) without the page moving.
    """
    if not final_url:
        return False
    if _host(requested_url) != _host(final_url):
        return True
    return _path_segments(requested_url) != _path_segments(final_url)


def verify_identity(
    *,
    product_url: str,
    final_url: str | None,
    page_title: str | None,
    item_title: str | None = None,
    verified_title: str | None = None,
) -> IdentityVerdict:
    """Decide whether the page we fetched is still the product we asked for.

    Args:
        product_url: The link we asked for.
        final_url: Where the request actually landed.
        page_title: The title of the page that answered.
        item_title: The item's title as the owner sees it (may be edited).
        verified_title: The page title the last confirmed check saw.
    """
    slug = slug_text(product_url)
    references = [t for t in (verified_title, item_title, slug) if t]
    scores = [
        s
        for s in (title_similarity(page_title, r) for r in references)
        if s is not None
    ]
    best = max(scores) if scores else None

    if landed_elsewhere(product_url, final_url):
        # A redirect is only benign when the page still names the same
        # product - stores do move products to new URLs.
        if best is not None and best >= SAME_PRODUCT_RATIO:
            return IdentityVerdict(True)
        where = "a product list" if is_listing_url(final_url) else "another page"
        return IdentityVerdict(
            False,
            PriceCheckFailureReason.LINK_MOVED,
            f"redirected to {where}: {final_url}",
        )

    if best is None:
        # Nothing to compare against. The link itself hasn't moved, so this
        # is the same page we have always read - take the price.
        return IdentityVerdict(True)

    # A title we confirmed on an earlier check, or a descriptive slug, is
    # solid evidence. The owner's own title alone is not - they rename items.
    strong_evidence = bool(verified_title) or len(_tokens(slug)) >= 2
    threshold = DIFFERENT_PRODUCT_RATIO if strong_evidence else WEAK_EVIDENCE_RATIO
    if best < threshold:
        return IdentityVerdict(
            False,
            PriceCheckFailureReason.DIFFERENT_PRODUCT,
            f"page is titled {page_title!r} (similarity {best:.2f})",
        )

    return IdentityVerdict(True)
