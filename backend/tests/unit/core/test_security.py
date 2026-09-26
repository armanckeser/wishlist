"""Password hashing behaviour for the bcrypt-backed security helpers.

These pin the properties the login flow depends on, including compatibility
with the hashes written by the previous passlib-based implementation.
"""

import bcrypt
import pytest

from app.core.security import get_password_hash, verify_password

# $2b$ / 12 rounds / 72-byte truncation is exactly what the previous
# implementation (passlib CryptContext with the "bcrypt" scheme) wrote, so
# a regression in format or truncation point is caught here instead of
# locking every existing user out of the deployment.
LEGACY_PASSLIB_HASHES = {
    "hunter2": "$2b$12$S51lHpIIuj1IdHufgdFA6O0LdUVSSfvJYY73uuWHgTnyco4dQtGaq",
    "pässwörd-ünicode": "$2b$12$lOkKvPAeh4rawrzc6liECeJ4Fws73x8t4kTCMYJIxiONpxkw02xO.",
}


def test_hash_and_verify_roundtrip() -> None:
    hashed = get_password_hash("correct horse battery staple")
    assert verify_password("correct horse battery staple", hashed)


def test_wrong_password_is_rejected() -> None:
    hashed = get_password_hash("correct horse battery staple")
    assert not verify_password("Correct horse battery staple", hashed)


def test_hash_is_salted() -> None:
    """Two hashes of the same password must differ, and both must verify."""
    first = get_password_hash("same-password")
    second = get_password_hash("same-password")
    assert first != second
    assert verify_password("same-password", first)
    assert verify_password("same-password", second)


def test_hash_uses_the_modern_bcrypt_prefix() -> None:
    assert get_password_hash("whatever").startswith("$2b$")


@pytest.mark.parametrize(("password", "hashed"), LEGACY_PASSLIB_HASHES.items())
def test_hashes_written_by_passlib_still_verify(password: str, hashed: str) -> None:
    assert verify_password(password, hashed)


def test_non_ascii_password_roundtrips() -> None:
    password = "übermäßig-långt-lösenord-🔐"
    assert verify_password(password, get_password_hash(password))


def test_password_longer_than_the_bcrypt_limit_is_truncated_not_rejected() -> None:
    """bcrypt ignores everything past 72 bytes; passlib truncated silently.

    Hashing must not raise, and — matching the old behaviour — two passwords
    that share their first 72 bytes must verify against each other.
    """
    password = "a" * 80
    hashed = get_password_hash(password)
    assert verify_password(password, hashed)
    assert verify_password("a" * 72, hashed)
    assert not verify_password("a" * 71, hashed)


def test_multibyte_password_truncation_matches_byte_boundary() -> None:
    """Truncation is on encoded bytes, so a 3-byte char counts as 3."""
    password = "€" * 40  # 120 bytes
    hashed = get_password_hash(password)
    assert verify_password(password, hashed)
    assert verify_password("€" * 24, hashed)  # first 72 bytes


def test_malformed_stored_hash_is_a_mismatch_not_an_error() -> None:
    """A corrupt hashed_password column must fail login, not 500 the request."""
    assert not verify_password("anything", "")
    assert not verify_password("anything", "not-a-bcrypt-hash")


def test_hash_is_readable_by_the_bcrypt_library_directly() -> None:
    hashed = get_password_hash("interop")
    assert bcrypt.checkpw(b"interop", hashed.encode())
