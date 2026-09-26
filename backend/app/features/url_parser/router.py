"""URL parsing router."""

import logging

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser
from app.features.url_parser.models import ParseUrlRequest, ParseUrlResponse
from app.features.url_parser.service import FetchError, ParseError, parse_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/url-parser", tags=["url-parser"])


@router.post("/parse", response_model=ParseUrlResponse)
async def parse_product_url(
    request: ParseUrlRequest,
    _current_user: CurrentUser,  # Required for auth, value not used
) -> ParseUrlResponse:
    """Parse product metadata from a URL.

    Extracts title, description, image, and price from e-commerce product pages.
    Uses structured data (JSON-LD, OpenGraph, Microdata) when available.

    Returns 422 if product data cannot be extracted.
    """
    url_str = str(request.url)
    logger.info(f"Parsing URL: {url_str}")

    try:
        metadata, extraction_method = await parse_url(url_str)
    except FetchError as e:
        logger.warning(
            f"FetchError for {url_str}: {e.message} (status={e.status_code})"
        )
        if e.status_code == 403:
            raise HTTPException(
                status_code=422,
                detail="This site blocks automated requests. Please enter product details manually.",
            )
        if e.status_code == 404:
            raise HTTPException(status_code=404, detail="Product page not found")
        raise HTTPException(
            status_code=502,
            detail=f"Could not fetch URL: {e.message}",
        )
    except ParseError as e:
        logger.warning(f"ParseError for {url_str}: {e.message}")
        raise HTTPException(
            status_code=422,
            detail="Could not extract product data from this page. Please enter details manually.",
        )

    logger.info(
        f"Successfully parsed {url_str}: title={metadata.title!r}, "
        f"price={metadata.price_cents}, method={extraction_method}"
    )

    return ParseUrlResponse(
        title=metadata.title,
        description=metadata.description,
        image_url=metadata.image_url,
        price_cents=metadata.price_cents,
        currency=metadata.currency,
        source_url=metadata.source_url,
        final_url=metadata.final_url,
        extraction_method=extraction_method,
        brand=metadata.brand,
        category=metadata.category,
        breadcrumbs=metadata.breadcrumbs,
    )
