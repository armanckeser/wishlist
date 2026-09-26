"""17track API client for package tracking.

Carrier Code Management:
-----------------------
CARRIER_CODE_MAP contains codes for common carriers. For carriers not in the map,
17track auto-detects the carrier - no manual maintenance required.

To add a new carrier (optional, for faster detection):
1. Check logs for "not in CARRIER_CODE_MAP" messages
2. Look up carrier code at https://17track.net
3. Add to CARRIER_CODE_MAP: "carrier_code": numeric_code
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any
from urllib.parse import parse_qs, urlparse

import cachebox
import httpx
from aiolimiter import AsyncLimiter
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)
from tracking_numbers import get_tracking_number

from app.features.tracking.models import (
    SeventeenTrackResponse,
    TrackingParseResponse,
)

if TYPE_CHECKING:
    from app.features.tracking.models import TrackInfo

logger = logging.getLogger(__name__)


# Carrier code mapping from tracking-numbers library to 17track API
CARRIER_CODE_MAP: dict[str, int] = {
    "ups": 100002,
    "fedex": 100003,
    "usps": 21051,
    "dhl": 100001,
    "dhl_express": 100001,
}

# Known tracking query parameter names
TRACKING_QUERY_PARAMS = frozenset(
    [
        "tracknumbers",
        "tracknum",
        "tracknums",
        "tlabels",
        "awb",
        "tracking",
        "track",
        "packageid",
        "trackingnumber",
        "num",
        "number",
    ]
)

# Domain to carrier name mapping (for fallback inference)
# Names should match what tracking-numbers library returns when possible
CARRIER_DOMAINS: dict[str, str] = {
    "lasership.com": "LaserShip",
    "fedex.com": "FedEx",
    "ups.com": "UPS",
    "usps.com": "United States Postal Service",  # Match tracking-numbers library
    "dhl.com": "DHL",
    "ontrac.com": "OnTrac",
}


def _looks_like_tracking_number(candidate: str) -> bool:
    """Heuristic check: alphanumeric, 6-40 chars, contains digits."""
    clean = candidate.replace("-", "").replace(" ", "")
    if not clean.isalnum():
        return False
    if len(clean) < 6 or len(clean) > 40:
        return False
    if not any(c.isdigit() for c in clean):
        return False
    return True


def _get_carrier_from_domain(domain: str) -> str | None:
    """Infer carrier from URL domain."""
    domain = domain.lower().replace("www.", "").replace("tools.", "").replace("t.", "")
    for carrier_domain, carrier_name in CARRIER_DOMAINS.items():
        if carrier_domain in domain:
            return carrier_name
    return None


class TrackingURLParser:
    """Parse tracking numbers from carrier tracking URLs."""

    @classmethod
    def parse_url(cls, url: str) -> tuple[str | None, str | None]:
        """Extract tracking number and carrier from a tracking URL.

        Strategy:
        1. Try query params with known tracking parameter names
        2. Try last path segment that looks like a tracking number
        3. Infer carrier from domain if extraction succeeds

        Returns:
            Tuple of (tracking_number, carrier_name) or (None, None)
        """
        try:
            parsed = urlparse(url)
        except Exception:
            return None, None

        candidates: list[str] = []

        # Extract from query params
        query_params = parse_qs(parsed.query)
        for param, values in query_params.items():
            if param.lower() in TRACKING_QUERY_PARAMS and values:
                candidates.extend(values)

        # Extract from path (last alphanumeric segment)
        path_parts = [p for p in parsed.path.split("/") if p and "." not in p]
        if path_parts:
            last_segment = path_parts[-1]
            if _looks_like_tracking_number(last_segment):
                candidates.append(last_segment)

        # Validate candidates with tracking-numbers library
        for candidate in candidates:
            result = get_tracking_number(candidate)
            if result and result.valid:
                return result.number, result.courier.name

        # Fall back to domain inference for first valid-looking candidate
        carrier_from_domain = _get_carrier_from_domain(parsed.netloc)
        if carrier_from_domain:
            for candidate in candidates:
                if _looks_like_tracking_number(candidate):
                    logger.info(
                        "Tracking number %s inferred as %s from domain (not validated by library)",
                        candidate,
                        carrier_from_domain,
                    )
                    return candidate, carrier_from_domain

        return None, None


class SeventeenTrackClient:
    """Async client for 17track API v2.4 with rate limiting and caching.

    Handles registration and status fetching for package tracking.
    Uses tracking-numbers library for carrier detection.

    Example:
        >>> client = SeventeenTrackClient(api_key="your_key")
        >>> info = await client.track_package("888079995075")
        >>> print(info.normalized_status)
        >>> await client.close()
    """

    BASE_URL = "https://api.17track.net/track/v2.4"
    RATE_LIMIT_PER_SECOND = 3
    MAX_BATCH_SIZE = 40
    TIMEOUT_SECONDS = 30.0
    CACHE_TTL_SECONDS = 300  # 5 minutes

    def __init__(self, api_key: str) -> None:
        """Initialize client with API key.

        Args:
            api_key: 17track API key from Settings -> Security -> Access Key
        """
        self.api_key = api_key
        self.headers = {
            "Content-Type": "application/json",
            "17token": api_key,
        }
        # Rate limiter: 3 requests per second
        self._rate_limiter = AsyncLimiter(self.RATE_LIMIT_PER_SECOND, 1)
        # Shared HTTP client for connection pooling
        self._http_client: httpx.AsyncClient | None = None
        # Cache for tracking responses
        self._cache: cachebox.TTLCache[str, TrackInfo] = cachebox.TTLCache(
            maxsize=500, ttl=self.CACHE_TTL_SECONDS
        )

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create shared HTTP client."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                headers=self.headers,
                timeout=self.TIMEOUT_SECONDS,
            )
        return self._http_client

    async def close(self) -> None:
        """Close HTTP client. Call when done with client."""
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()

    @retry(
        retry=retry_if_exception_type(httpx.HTTPStatusError),
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=1, max=30),
        reraise=True,
    )
    async def _make_request(
        self,
        endpoint: str,
        payload: list[dict[str, Any]],
    ) -> httpx.Response:
        """Make rate-limited request with retry on failure."""
        async with self._rate_limiter:
            client = await self._get_client()
            response = await client.post(
                f"{self.BASE_URL}/{endpoint}",
                json=payload,
            )
            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After", "unknown")
                logger.warning("Rate limited by 17track, Retry-After: %s", retry_after)
            response.raise_for_status()
            return response

    def detect_carrier(
        self, tracking_number: str
    ) -> tuple[str | None, int | None, str | None]:
        """Detect carrier from tracking number using tracking-numbers library.

        For carriers not in CARRIER_CODE_MAP, returns None for carrier_code.
        17track API will auto-detect the carrier.

        Args:
            tracking_number: Raw tracking number string

        Returns:
            Tuple of (carrier_name, carrier_code, tracking_url) or (None, None, None)
        """
        result = get_tracking_number(tracking_number)
        if not result or not result.valid:
            return None, None, None

        carrier_name = result.courier.name
        carrier_code = CARRIER_CODE_MAP.get(result.courier.code.lower())

        if not carrier_code:
            logger.info(
                "Carrier '%s' (%s) not in CARRIER_CODE_MAP. 17track will auto-detect.",
                result.courier.code,
                carrier_name,
            )

        tracking_url = getattr(result, "tracking_url", None)

        return carrier_name, carrier_code, tracking_url

    def parse_tracking_input(self, input_str: str) -> TrackingParseResponse:
        """Parse a tracking number or URL into structured tracking info.

        Handles:
        - Raw tracking numbers (auto-detect carrier)
        - FedEx, UPS, USPS tracking URLs (extract number and carrier)

        Args:
            input_str: Tracking number or tracking URL

        Returns:
            Parsed tracking information with validation status
        """
        input_str = input_str.strip()

        # Check if input is a URL
        if input_str.startswith(("http://", "https://")):
            tracking_number, url_carrier = TrackingURLParser.parse_url(input_str)
            if tracking_number:
                # Validate and get more info from tracking-numbers library
                carrier_name, carrier_code, tracking_url = self.detect_carrier(
                    tracking_number
                )

                # Use URL-detected carrier if library didn't detect
                if not carrier_name and url_carrier:
                    carrier_name = url_carrier.upper()
                    carrier_code = CARRIER_CODE_MAP.get(url_carrier.lower())

                return TrackingParseResponse(
                    tracking_number=tracking_number,
                    carrier=carrier_name,
                    carrier_code=carrier_code,
                    is_valid=True,
                    tracking_url=tracking_url,
                )

            # URL but couldn't parse - return invalid
            return TrackingParseResponse(
                tracking_number=input_str,
                carrier=None,
                carrier_code=None,
                is_valid=False,
                tracking_url=None,
            )

        # Raw tracking number
        carrier_name, carrier_code, tracking_url = self.detect_carrier(input_str)

        return TrackingParseResponse(
            tracking_number=input_str,
            carrier=carrier_name,
            carrier_code=carrier_code,
            is_valid=carrier_name is not None,
            tracking_url=tracking_url,
        )

    async def register_tracking_numbers(
        self,
        tracking_numbers: list[str],
        carrier_codes: dict[str, int] | None = None,
    ) -> SeventeenTrackResponse:
        """Register tracking numbers for monitoring with 17track.

        Args:
            tracking_numbers: List of tracking numbers (max 40)
            carrier_codes: Optional mapping of tracking_number -> carrier_code

        Returns:
            API response with accepted/rejected numbers

        Raises:
            httpx.HTTPStatusError: If API returns error status
            ValueError: If too many tracking numbers provided
        """
        if len(tracking_numbers) > self.MAX_BATCH_SIZE:
            raise ValueError(
                f"Maximum {self.MAX_BATCH_SIZE} tracking numbers per request"
            )

        carrier_codes = carrier_codes or {}
        payload = []

        for number in tracking_numbers:
            item: dict[str, str | int] = {"number": number}

            # Add carrier code if provided or auto-detect
            if number in carrier_codes:
                item["carrier"] = carrier_codes[number]
            else:
                _, detected_code, _ = self.detect_carrier(number)
                if detected_code:
                    item["carrier"] = detected_code

            payload.append(item)

        response = await self._make_request("register", payload)
        return SeventeenTrackResponse.model_validate(response.json())

    async def get_tracking_info(
        self,
        tracking_numbers: list[str],
    ) -> SeventeenTrackResponse:
        """Fetch current tracking status for registered numbers.

        Args:
            tracking_numbers: List of registered tracking numbers (max 40)

        Returns:
            API response with tracking information

        Raises:
            httpx.HTTPStatusError: If API returns error status
            ValueError: If too many tracking numbers provided

        Note:
            Numbers must be registered first via register_tracking_numbers()
        """
        if len(tracking_numbers) > self.MAX_BATCH_SIZE:
            raise ValueError(
                f"Maximum {self.MAX_BATCH_SIZE} tracking numbers per request"
            )

        payload = [{"number": num} for num in tracking_numbers]
        response = await self._make_request("gettrackinfo", payload)
        return SeventeenTrackResponse.model_validate(response.json())

    async def track_package(self, tracking_number: str) -> TrackInfo | None:
        """Register and fetch tracking info with caching.

        Args:
            tracking_number: Tracking number to track

        Returns:
            TrackInfo if successful, None otherwise
        """
        # Check cache first
        cached = self._cache.get(tracking_number)
        if cached is not None:
            logger.debug("Cache hit for tracking number %s", tracking_number)
            return cached

        # Register
        register_response = await self.register_tracking_numbers([tracking_number])
        if not register_response.is_success:
            return None

        # Fetch
        info_response = await self.get_tracking_info([tracking_number])
        if not info_response.is_success:
            return None

        results = info_response.get_accepted()
        if not results or not results[0].track_info:
            return None

        track_info = results[0].track_info

        # Cache result
        self._cache[tracking_number] = track_info

        return track_info
