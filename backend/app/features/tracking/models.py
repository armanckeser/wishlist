"""Pydantic models for package tracking with 17track API.

These models represent the 17track API v2.4 response structure
and provide type-safe access to tracking information.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field
from sqlmodel import SQLModel

if TYPE_CHECKING:
    pass


class DeliveryStatus(str, Enum):
    """Normalized delivery status from 17track."""

    NOT_FOUND = "not_found"
    INFO_RECEIVED = "info_received"
    IN_TRANSIT = "in_transit"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    EXCEPTION = "exception"
    EXPIRED = "expired"


class TrackingAddress(BaseModel):
    """Address information from tracking event."""

    country: str | None = None
    state: str | None = None
    city: str | None = None
    postal_code: str | None = None


class TrackingEvent(BaseModel):
    """Single tracking event from carrier."""

    time_iso: str | None = None
    time_utc: str | None = None
    description: str
    location: str | None = None
    stage: str | None = None
    sub_status: str | None = None
    address: TrackingAddress | None = None

    @property
    def timestamp(self) -> datetime | None:
        """Parse ISO timestamp to datetime."""
        if self.time_utc:
            try:
                return datetime.fromisoformat(self.time_utc.replace("Z", "+00:00"))
            except ValueError:
                return None
        return None


class EstimatedDeliveryDate(BaseModel):
    """Estimated delivery date range from carrier."""

    source: str | None = None
    from_date: str | None = Field(None, alias="from")
    to_date: str | None = Field(None, alias="to")

    model_config = {"populate_by_name": True}

    @property
    def earliest(self) -> datetime | None:
        """Parse earliest estimated delivery datetime."""
        if self.from_date:
            try:
                return datetime.fromisoformat(self.from_date)
            except ValueError:
                return None
        return None

    @property
    def latest(self) -> datetime | None:
        """Parse latest estimated delivery datetime."""
        if self.to_date:
            try:
                return datetime.fromisoformat(self.to_date)
            except ValueError:
                return None
        return None


class TimeMetrics(BaseModel):
    """Time metrics for shipment."""

    days_after_order: int | None = None
    days_of_transit: int | None = None
    days_of_transit_done: int | None = None
    days_after_last_update: int | None = None
    estimated_delivery_date: EstimatedDeliveryDate | None = None


class LatestStatus(BaseModel):
    """Latest tracking status from 17track."""

    status: str
    sub_status: str | None = None
    sub_status_descr: str | None = None


class CarrierProvider(BaseModel):
    """Carrier provider information."""

    key: int
    name: str
    alias: str | None = None
    tel: str | None = None
    homepage: str | None = None
    country: str | None = None


class ProviderTracking(BaseModel):
    """Tracking data from a specific carrier."""

    provider: CarrierProvider
    service_type: str | None = None
    latest_sync_status: str | None = None
    latest_sync_time: str | None = None
    events: list[TrackingEvent] = Field(default_factory=list)
    provider_tips: str | None = None


class TrackingProviders(BaseModel):
    """Container for carrier tracking data."""

    providers_hash: int | None = None
    providers: list[ProviderTracking] = Field(default_factory=list)


class Milestone(BaseModel):
    """Shipping milestone with timestamp."""

    key_stage: str
    time_iso: str | None = None
    time_utc: str | None = None


class TrackInfo(BaseModel):
    """Full tracking information from 17track."""

    latest_status: LatestStatus | None = None
    latest_event: TrackingEvent | None = None
    time_metrics: TimeMetrics | None = None
    milestone: list[Milestone] = Field(default_factory=list)
    tracking: TrackingProviders | None = None

    @property
    def carrier_name(self) -> str | None:
        """Get primary carrier name."""
        if self.tracking and self.tracking.providers:
            return self.tracking.providers[0].provider.name
        return None

    @property
    def events(self) -> list[TrackingEvent]:
        """Get all tracking events from primary carrier."""
        if self.tracking and self.tracking.providers:
            return self.tracking.providers[0].events
        return []

    @property
    def estimated_delivery(self) -> datetime | None:
        """Get earliest estimated delivery date."""
        if self.time_metrics and self.time_metrics.estimated_delivery_date:
            return self.time_metrics.estimated_delivery_date.earliest
        return None

    @property
    def normalized_status(self) -> DeliveryStatus:
        """Convert 17track status to normalized DeliveryStatus enum."""
        if not self.latest_status:
            return DeliveryStatus.NOT_FOUND

        status = self.latest_status.status.lower()
        sub_status = (self.latest_status.sub_status or "").lower()

        if status == "delivered":
            return DeliveryStatus.DELIVERED
        if "outfordelivery" in sub_status or status == "outfordelivery":
            return DeliveryStatus.OUT_FOR_DELIVERY
        if status == "intransit":
            return DeliveryStatus.IN_TRANSIT
        if "inforeceived" in sub_status or status == "inforeceived":
            return DeliveryStatus.INFO_RECEIVED
        if status in ("expired", "notfound"):
            return (
                DeliveryStatus.EXPIRED
                if status == "expired"
                else DeliveryStatus.NOT_FOUND
            )
        if status in ("alert", "exception", "undelivered"):
            return DeliveryStatus.EXCEPTION

        return DeliveryStatus.IN_TRANSIT


class TrackingResult(BaseModel):
    """Result for a single tracked package from 17track."""

    number: str
    carrier: int | None = None
    track_info: TrackInfo | None = None


class SeventeenTrackResponse(BaseModel):
    """17track API response wrapper."""

    code: int
    data: dict[str, list[dict[str, object]]]

    @property
    def is_success(self) -> bool:
        """Check if API call was successful."""
        return self.code == 0

    def get_accepted(self) -> list[TrackingResult]:
        """Get successfully processed tracking results."""
        accepted = self.data.get("accepted", [])
        return [TrackingResult.model_validate(item) for item in accepted]

    def get_rejected(self) -> list[dict[str, object]]:
        """Get rejected tracking numbers with error details."""
        return self.data.get("rejected", [])


# Request/Response models for API endpoints


class TrackingEventPublic(SQLModel):
    """Simplified tracking event for public API responses."""

    timestamp: datetime | None = None
    description: str
    location: str | None = None


class TrackingParseRequest(SQLModel):
    """Request to parse a tracking number or URL."""

    input: str = Field(min_length=1, max_length=2048)


class TrackingParseResponse(SQLModel):
    """Response from parsing a tracking input."""

    tracking_number: str
    carrier: str | None = None
    carrier_code: int | None = None
    is_valid: bool
    tracking_url: str | None = None


class TrackingStatusPublic(SQLModel):
    """Public tracking status for API responses."""

    tracking_number: str
    carrier: str | None = None
    status: DeliveryStatus
    status_label: str
    estimated_delivery_at: datetime | None = None
    latest_event_description: str | None = None
    latest_event_location: str | None = None
    latest_event_at: datetime | None = None
    events: list[TrackingEvent] = Field(default_factory=list)
    synced_at: datetime | None = None


class TrackedItemPublic(SQLModel):
    """Public response model for tracked items (TRACKING status)."""

    # Inherit common fields pattern from WishlistItem
    pass  # Will be defined after we see the full WishlistItem pattern


class TrackingSyncResponse(SQLModel):
    """Response from sync all tracking operation."""

    synced_count: int
    message: str
