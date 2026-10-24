"""First-start setup for a self-hosted install, run once before the server starts.

An install from an app store has no terminal step, so the keys the app needs are
generated here and kept in the `instance_secret` table: the session signing key
(SECRET_KEY) and the Web Push key pair. An environment value always wins and is
never written to the database.

Prints `export NAME=value` lines for the start script to eval, so every worker
process sees the same values.
"""

import base64
import secrets
import shlex
import sys

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from sqlalchemy import text

from app.core.config import settings
from app.core.db import engine


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _vapid_pair() -> str:
    key = ec.generate_private_key(ec.SECP256R1())
    private = _b64url(key.private_numbers().private_value.to_bytes(32, "big"))
    public = _b64url(
        key.public_key().public_bytes(
            serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
        )
    )
    return f"{public}:{private}"


def _stored(key: str, generate: str) -> str:
    """The stored value for `key`, saving `generate` on first start."""
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO instance_secret (key, value) VALUES (:key, :value) "
                "ON CONFLICT (key) DO NOTHING"
            ),
            {"key": key, "value": generate},
        )
        return connection.execute(
            text("SELECT value FROM instance_secret WHERE key = :key"), {"key": key}
        ).scalar_one()


def main() -> None:
    exports: dict[str, str] = {}
    if not settings.SECRET_KEY_FROM_ENV:
        exports["SECRET_KEY"] = _stored("secret_key", secrets.token_urlsafe(32))
    if not (settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY):
        public, private = _stored("vapid", _vapid_pair()).split(":")
        exports["VAPID_PUBLIC_KEY"] = public
        exports["VAPID_PRIVATE_KEY"] = private
    for name, value in exports.items():
        sys.stdout.write(f"export {name}={shlex.quote(value)}\n")


if __name__ == "__main__":
    main()
