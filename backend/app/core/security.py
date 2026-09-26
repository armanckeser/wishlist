from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from app.core.config import settings

ALGORITHM = "HS256"

# bcrypt only consumes the first 72 bytes of a password; anything beyond that
# is ignored by the algorithm itself. passlib (which this module used to wrap)
# silently truncated at that boundary, so we keep truncating in exactly the
# same place — otherwise every password longer than 72 bytes hashed under the
# old code would stop verifying.
_BCRYPT_MAX_BYTES = 72


def _to_bcrypt_bytes(password: str) -> bytes:
    """Encode a password the way bcrypt expects, truncated to the 72-byte limit."""
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def create_access_token(subject: str | Any, expires_delta: timedelta) -> str:
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            _to_bcrypt_bytes(plain_password), hashed_password.encode("utf-8")
        )
    except ValueError:
        # Raised for a stored value that isn't a well-formed bcrypt hash.
        # A malformed hash is not a match, not a server error.
        return False


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(_to_bcrypt_bytes(password), bcrypt.gensalt()).decode("utf-8")
