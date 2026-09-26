"""URL parsing service with unified fetch-and-extract pipeline."""

import logging
import random
import time
from collections.abc import Awaitable, Callable
from functools import lru_cache
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import httpx
from curl_cffi import requests as curl_requests

from app.core.config import settings
from app.features.url_parser.models import (
    ExtractionStrategy,
    FetchResult,
    ProductMetadata,
)
from app.features.url_parser.strategies import (
    EmbeddedJsonStrategy,
    HtmlFallbackStrategy,
    JsonLdStrategy,
    MicrodataStrategy,
    OpenGraphStrategy,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Configuration
# =============================================================================

MIN_VALID_HTML_LENGTH = 5000

DEFAULT_STRATEGIES: list[ExtractionStrategy] = [
    JsonLdStrategy(),
    OpenGraphStrategy(),
    MicrodataStrategy(),
    EmbeddedJsonStrategy(),
    HtmlFallbackStrategy(),
]

USER_AGENT_POOL = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
]

# Sites that httpx can't handle - skip straight to curl_cffi
SITES_PREFERRING_IMPERSONATION = {
    "hermes.com",
    "maxmara.com",
    "mrporter.com",
    "net-a-porter.com",
    "revolve.com",
    "sephora.com",
}

# Sites that are JS SPAs requiring real browser rendering (FlareSolverr)
SITES_REQUIRING_FLARESOLVERR = {
    "elemis.com",
}

TRACKING_PARAM_PREFIXES = {
    "utm_",
    "gclid",
    "gclsrc",
    "gad_",
    "gbraid",
    "wbraid",
    "fbclid",
    "fb_",
    "mc_",
    "msclkid",
    "dclid",
    "zanpid",
    "igshid",
    "s_kwcid",
    "ef_id",
    "epik",
    "_ga",
    "_gl",
}

TRACKING_PARAMS_EXACT = {
    "ref",
    "source",
    "campaign",
    "medium",
    "engineid",
    "affiliate",
    "clickid",
}


# =============================================================================
# Exceptions
# =============================================================================


class FetchError(Exception):
    """Failed to fetch URL content."""

    def __init__(self, url: str, status_code: int | None = None, message: str = ""):
        self.url = url
        self.status_code = status_code
        self.message = message
        super().__init__(f"Failed to fetch {url}: {message}")


class ParseError(Exception):
    """Failed to parse product metadata from URL."""

    def __init__(self, url: str, message: str = ""):
        self.url = url
        self.message = message
        super().__init__(f"Failed to parse {url}: {message}")


# =============================================================================
# Helpers
# =============================================================================


def _get_browser_headers(url: str) -> dict[str, str]:
    """Generate realistic browser headers with User-Agent rotation."""
    parsed = urlparse(url)
    user_agent = random.choice(USER_AGENT_POOL)
    chrome_version = "121" if "Chrome/121" in user_agent else "120"

    return {
        "User-Agent": user_agent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Upgrade-Insecure-Requests": "1",
        "sec-ch-ua": f'"Not_A Brand";v="8", "Chromium";v="{chrome_version}", "Google Chrome";v="{chrome_version}"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"' if "Macintosh" in user_agent else '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Referer": f"https://www.google.com/search?q={parsed.netloc}",
    }


def _random_delay(min_sec: float = 0.5, max_sec: float = 1.5) -> None:
    """Add a random delay to simulate human behavior."""
    time.sleep(random.uniform(min_sec, max_sec))


def strip_tracking_params(url: str) -> str:
    """Remove tracking parameters from a URL."""
    parsed = urlparse(url)
    if not parsed.query:
        return url

    params = parse_qs(parsed.query, keep_blank_values=True)
    cleaned = {
        k: v
        for k, v in params.items()
        if not any(k.lower().startswith(p) for p in TRACKING_PARAM_PREFIXES)
        and k.lower() not in TRACKING_PARAMS_EXACT
    }

    new_query = urlencode(cleaned, doseq=True)
    return urlunparse(
        (parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, "")
    )


def _is_challenge_page(html: str) -> bool:
    """Detect if HTML is a bot detection challenge page."""
    challenge_patterns = [
        "captcha-delivery.com",
        "geo.captcha-delivery.com",
        "ct.captcha-delivery.com",
        "/s-BkvkIYqW/",
        "cf-mitigated",
        "_cf_chl_opt",
    ]
    if any(p in html for p in challenge_patterns):
        return True

    if len(html) < MIN_VALID_HTML_LENGTH:
        reload_patterns = ["location.reload", "XMLHttpRequest.prototype.send"]
        if any(p in html for p in reload_patterns):
            return True

    return False


def _prefers_impersonation(url: str) -> bool:
    """Check if URL's domain works better with TLS impersonation."""
    domain = urlparse(url).netloc.lower()
    return any(site in domain for site in SITES_PREFERRING_IMPERSONATION)


def _requires_flaresolverr(url: str) -> bool:
    """Check if URL's domain is a JS SPA requiring real browser rendering."""
    domain = urlparse(url).netloc.lower()
    return any(site in domain for site in SITES_REQUIRING_FLARESOLVERR)


# =============================================================================
# Fetch Methods - each returns str | None (no exceptions for control flow)
# =============================================================================

# Type for fetch methods: async callable returning the page (with the URL it
# was served from) or None.
FetchMethod = Callable[[str, float], Awaitable[FetchResult | None]]


# Per-domain session cache for curl_cffi (keeps cookies, reduces connection overhead)
@lru_cache(maxsize=32)
def _get_curl_session(_domain: str) -> curl_requests.Session:
    """Get or create a curl_cffi session for a domain."""
    return curl_requests.Session(impersonate="chrome")


# Track which domains have been warmed up (homepage visited)
_warmed_up_domains: set[str] = set()


async def _fetch_httpx(url: str, timeout: float) -> FetchResult | None:
    """Fetch with standard httpx client."""
    headers = _get_browser_headers(url)
    parsed = urlparse(url)
    homepage = f"{parsed.scheme}://{parsed.netloc}/"

    # Shorter timeout for warmup - don't wait long if site is slow/blocking
    warmup_timeout = min(timeout, 5.0)

    try:
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=timeout, headers=headers
        ) as client:
            # Warmup: hit homepage first for cookies (quick timeout)
            try:
                await client.get(homepage, timeout=warmup_timeout)
                _random_delay(0.3, 0.8)
            except httpx.HTTPError:
                pass

            response = await client.get(url)
            if response.status_code >= 400:
                logger.debug(f"httpx got {response.status_code} for {url}")
                return None
            return FetchResult(response.text, str(response.url))
    except httpx.HTTPError as e:
        logger.debug(f"httpx failed for {url}: {e}")
        return None


async def _fetch_curl_cffi(url: str, timeout: float) -> FetchResult | None:
    """Fetch with curl_cffi Chrome TLS impersonation.

    Uses per-domain session caching - sessions are reused for the same domain,
    maintaining cookies and connection state like a real browser.
    """
    parsed = urlparse(url)
    domain = parsed.netloc
    homepage = f"{parsed.scheme}://{domain}/"

    session = _get_curl_session(domain)

    try:
        # Only do warmup navigation once per domain per process lifetime
        if domain not in _warmed_up_domains:
            session.get(homepage, timeout=timeout)
            _warmed_up_domains.add(domain)
            _random_delay(0.5, 1.5)

        response = session.get(url, timeout=timeout)
        if response.status_code >= 400:
            logger.debug(f"curl_cffi got {response.status_code} for {url}")
            return None
        return FetchResult(response.text, str(response.url) or url)
    except curl_requests.RequestsError as e:
        logger.debug(f"curl_cffi failed for {url}: {e}")
        return None


async def _fetch_flaresolverr(url: str, timeout: float) -> FetchResult | None:
    """Fetch with FlareSolverr (real browser)."""
    if not settings.FLARESOLVERR_URL:
        logger.debug("FlareSolverr not configured")
        return None

    payload = {"cmd": "request.get", "url": url, "maxTimeout": int(timeout * 1000)}

    try:
        response = httpx.post(
            settings.FLARESOLVERR_URL,
            json=payload,
            timeout=timeout + 10,
        )
        response.raise_for_status()

        data = response.json()
        if data.get("status") != "ok":
            logger.debug(f"FlareSolverr error for {url}: {data.get('message')}")
            return None

        solution = data.get("solution", {})
        html = solution.get("response", "")
        if not html:
            return None
        return FetchResult(html, solution.get("url") or url)

    except httpx.HTTPError as e:
        logger.debug(f"FlareSolverr failed for {url}: {e}")
        return None


async def _fetch_google_cache(url: str, timeout: float) -> FetchResult | None:
    """Fetch from Google's cache as last resort."""
    cache_url = f"https://webcache.googleusercontent.com/search?q=cache:{url}"
    headers = _get_browser_headers(cache_url)

    try:
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=timeout, headers=headers
        ) as client:
            response = await client.get(cache_url)
            if response.status_code >= 400:
                return None
            html = response.text

            # Validate we got actual cached content, not a Google search fallback
            if len(html) < MIN_VALID_HTML_LENGTH:
                return None
            # Google Cache pages have a banner, but if we got redirected to
            # regular Google Search (cache miss), we'll see google search UI
            is_google_search = (
                "google.com/search" in str(response.url)
                or "<title>Google</title>" in html
                or "<title>Google Search</title>" in html
            )
            if is_google_search:
                logger.debug(f"Google Cache redirected to search for {url}")
                return None

            # The cache serves a copy of the original URL, so that is the URL
            # this content belongs to - not the webcache address.
            return FetchResult(html, url)
    except httpx.HTTPError:
        return None


def _get_fetch_methods(url: str) -> list[FetchMethod]:
    """Return fetch methods in priority order based on URL."""
    standard_order: list[FetchMethod] = [
        _fetch_httpx,
        _fetch_curl_cffi,
        _fetch_flaresolverr,
        _fetch_google_cache,
    ]

    # JS SPA sites: start with FlareSolverr (real browser rendering)
    if _requires_flaresolverr(url):
        return [
            _fetch_flaresolverr,
            _fetch_curl_cffi,
            _fetch_httpx,
            _fetch_google_cache,
        ]

    # Known-problematic sites: start with curl_cffi
    if _prefers_impersonation(url):
        return [
            _fetch_curl_cffi,
            _fetch_flaresolverr,
            _fetch_httpx,
            _fetch_google_cache,
        ]

    return standard_order


# =============================================================================
# Extraction
# =============================================================================


def _merge_metadata(
    primary: ProductMetadata, secondary: ProductMetadata
) -> ProductMetadata:
    """Merge two metadata objects, preferring primary but filling gaps from secondary."""
    return ProductMetadata(
        title=primary.title or secondary.title,
        description=primary.description or secondary.description,
        image_url=primary.image_url or secondary.image_url,
        price_cents=primary.price_cents
        if primary.price_cents is not None
        else secondary.price_cents,
        currency=primary.currency or secondary.currency,
        source_url=primary.source_url,
        final_url=primary.final_url or secondary.final_url,
        brand=primary.brand or secondary.brand,
        category=primary.category or secondary.category,
        breadcrumbs=primary.breadcrumbs or secondary.breadcrumbs,
    )


def _is_garbage_title(title: str | None, url: str) -> bool:
    """Check if a title is just a generic site name, not a real product title."""
    if not title:
        return True

    # Very short titles are suspicious (single chars, empty-ish)
    if len(title) < 3:
        return True

    # Generic site names that indicate we didn't get real product data
    domain = urlparse(url).netloc.lower().replace("www.", "")
    generic_patterns = [
        domain,  # "amazon.com", "sephora.com", etc.
        domain.split(".")[0],  # "amazon", "sephora", etc.
        "page not found",
        "404",
        "error",
        "access denied",
        "just a moment",  # Cloudflare
    ]
    title_lower = title.lower()
    return any(
        title_lower == pattern or title_lower == pattern.replace(".", "")
        for pattern in generic_patterns
    )


def _try_extract(
    html: str,
    url: str,
    strategies: list[ExtractionStrategy],
) -> tuple[ProductMetadata | None, str | None]:
    """Try extraction strategies, merging results to fill gaps.

    Returns None if extraction produces garbage data (generic site title, no price).
    """
    best: ProductMetadata | None = None
    method: str | None = None

    for strategy in strategies:
        try:
            result = strategy.extract(html, url)
            if result is None:
                continue

            if best is None:
                best, method = result, strategy.name
            else:
                best = _merge_metadata(best, result)

            if best.is_complete():
                break
        except Exception as e:
            logger.debug(f"Strategy {strategy.name} failed for {url}: {e}")

    # Validate extraction quality - garbage data means try next fetch method
    if best and _is_garbage_title(best.title, url):
        logger.debug(f"Extraction returned garbage title '{best.title}' for {url}")
        return None, None

    return best, method


# =============================================================================
# Public API
# =============================================================================


async def parse_url(
    url: str,
    strategies: list[ExtractionStrategy] | None = None,
    timeout: float = 15.0,
) -> tuple[ProductMetadata, str]:
    """Parse product metadata from a URL.

    Tries each fetch method in priority order. For each successful fetch,
    attempts extraction. If extraction fails, tries the next fetch method.
    This ensures we don't give up just because one method returns garbage HTML.

    Args:
        url: Product page URL to parse.
        strategies: Optional custom strategy list.
        timeout: Request timeout in seconds.

    Returns:
        Tuple of (metadata, extraction_method).

    Raises:
        ParseError: If no fetch+extract combination succeeds.
    """
    if strategies is None:
        strategies = DEFAULT_STRATEGIES

    clean_url = strip_tracking_params(url)
    fetch_methods = _get_fetch_methods(clean_url)
    attempted_methods: list[str] = []

    for fetch in fetch_methods:
        method_name = getattr(fetch, "__name__", "unknown").replace("_fetch_", "")
        logger.debug(f"Trying {method_name} for {clean_url}")

        fetched = await fetch(clean_url, timeout)
        if not fetched:
            attempted_methods.append(f"{method_name}:no_response")
            continue

        if _is_challenge_page(fetched.html):
            attempted_methods.append(f"{method_name}:challenge_page")
            continue

        metadata, extraction_method = _try_extract(fetched.html, clean_url, strategies)
        if metadata:
            metadata.final_url = fetched.final_url
            logger.info(f"Success: {method_name} + {extraction_method} for {clean_url}")
            return metadata, extraction_method or "unknown"

        attempted_methods.append(f"{method_name}:extraction_failed")
        logger.debug(
            f"{method_name} returned HTML but extraction failed for {clean_url}"
        )

    raise ParseError(url, f"All fetch methods failed: {', '.join(attempted_methods)}")


# Legacy exports for backward compatibility
async def fetch_url(url: str, timeout: float = 15.0) -> str:
    """Fetch HTML content from a URL (legacy API).

    Prefer using parse_url() directly - it handles fetch+extract together.
    """
    clean_url = strip_tracking_params(url)
    for fetch in _get_fetch_methods(clean_url):
        fetched = await fetch(clean_url, timeout)
        if fetched and not _is_challenge_page(fetched.html):
            return fetched.html
    raise FetchError(url, message="All fetch methods failed")


def extract_with_strategies(
    html: str,
    url: str,
    strategies: list[ExtractionStrategy] | None = None,
) -> tuple[ProductMetadata | None, str | None]:
    """Try extraction strategies in order (legacy API)."""
    if strategies is None:
        strategies = DEFAULT_STRATEGIES
    return _try_extract(html, url, strategies)
