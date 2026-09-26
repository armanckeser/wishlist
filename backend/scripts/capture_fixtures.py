#!/usr/bin/env python3
"""One-time script to capture real HTML from product pages as test fixtures.

Usage:
    uv run python scripts/capture_fixtures.py

This captures HTML from various e-commerce sites to use in unit tests.
Run this manually when you need to update the fixtures.
"""

import asyncio
from pathlib import Path

from app.features.url_parser.service import (
    _fetch_curl_cffi,
    _fetch_httpx,
)

FIXTURES_DIR = Path(__file__).parent.parent / "tests" / "fixtures" / "html"

URLS_TO_CAPTURE = {
    "mejuri_product.html": "https://mejuri.com/shop/products/diamond-bezel-necklace-gold-vermeil-london-blue-topaz",
    "sephora_product.html": "https://www.sephora.com/product/soft-pinch-liquid-blush-P97989",
    "netaporter_product.html": "https://www.net-a-porter.com/en-us/shop/product/reformation/clothing/midi-dresses/dusk-ribbed-stretch-tencel-modal-jersey-midi-dress/25185454457012757",
}


async def capture_fixture(name: str, url: str) -> None:
    """Capture HTML from URL and save as fixture."""
    print(f"Capturing {name} from {url}...")

    # Try curl_cffi first (handles more sites), fall back to httpx
    html = await _fetch_curl_cffi(url, timeout=30.0)
    if not html:
        html = await _fetch_httpx(url, timeout=30.0)

    if not html:
        print(f"  FAILED to fetch {url}")
        return

    output_path = FIXTURES_DIR / name
    output_path.write_text(html, encoding="utf-8")
    print(f"  Saved {len(html):,} bytes to {output_path}")


async def main() -> None:
    """Capture all fixtures."""
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

    for name, url in URLS_TO_CAPTURE.items():
        await capture_fixture(name, url)
        # Small delay between requests
        await asyncio.sleep(1)

    print("\nDone! Fixtures saved to:", FIXTURES_DIR)


if __name__ == "__main__":
    asyncio.run(main())
