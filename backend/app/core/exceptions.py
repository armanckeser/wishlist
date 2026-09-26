"""Domain exceptions for the application.

All service-layer exceptions should inherit from AppException.
The exception handler in main.py converts these to HTTP responses.
"""

from typing import ClassVar


class AppException(Exception):
    """Base exception for all domain errors."""

    status_code: ClassVar[int] = 500
    detail: str = "An unexpected error occurred"

    def __init__(self, detail: str | None = None):
        if detail:
            self.detail = detail
        super().__init__(self.detail)


class NotFoundError(AppException):
    """Resource not found."""

    status_code: ClassVar[int] = 404

    def __init__(self, resource: str = "Resource", identifier: str | None = None):
        if identifier:
            detail = f"{resource} '{identifier}' not found"
        else:
            detail = f"{resource} not found"
        super().__init__(detail)


class PermissionDeniedError(AppException):
    """User doesn't have permission to access this resource."""

    status_code: ClassVar[int] = 403
    detail = "You don't have permission to access this resource"


class ValidationError(AppException):
    """Invalid input or business rule violation."""

    status_code: ClassVar[int] = 400

    def __init__(self, detail: str):
        super().__init__(detail)


class ConflictError(AppException):
    """Resource already exists or conflict with current state."""

    status_code: ClassVar[int] = 409

    def __init__(self, detail: str):
        super().__init__(detail)


class InsufficientFundsError(ValidationError):
    """Not enough budget for this operation."""

    def __init__(self, required: int, available: int):
        detail = f"Insufficient budget: need ${required / 100:.2f}, have ${available / 100:.2f}"
        super().__init__(detail)
