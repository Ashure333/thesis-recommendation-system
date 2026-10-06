"""
Admin authentication for the library-facing site editor.

Everywhere else the app runs single-user and unauthenticated (see
local_user.py), but the site editor changes what all visitors see, so
it gets real credentials: a PBKDF2-hashed password and HMAC-signed
bearer tokens, built on the standard library so no new dependencies
are needed.

Environment overrides:
    RESEARCH_ADMIN_USERNAME  (default "admin")
    RESEARCH_ADMIN_PASSWORD  (default "admin"; change it after first
                              sign-in via the editor's password form)
    RESEARCH_ADMIN_SECRET    (token HMAC key; when unset a random one
                              is generated and kept in site_settings)
"""

import hashlib
import hmac
import os
import secrets
import time

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.models import SiteSetting, User

_PBKDF2_PREFIX = "pbkdf2_sha256"
_PBKDF2_ITERATIONS = 120_000
TOKEN_TTL_SECONDS = 12 * 60 * 60
_SECRET_KEY = "admin_token_secret"


def hash_password(password: str) -> str:
    """PBKDF2-SHA256 with a per-password salt, stored as one string."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        _PBKDF2_ITERATIONS,
    )
    return f"{_PBKDF2_PREFIX}${_PBKDF2_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    if not stored:
        return False

    try:
        prefix, iterations, salt, digest = stored.split("$")
    except ValueError:
        return False

    if prefix != _PBKDF2_PREFIX:
        return False

    try:
        candidate = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt),
            int(iterations),
        )
    except ValueError:
        return False

    return hmac.compare_digest(candidate.hex(), digest)


def ensure_admin_user(
    db: Session,
    username: str | None = None,
    password: str | None = None,
) -> User:
    """Fetch or create the site-editor account (idempotent)."""
    username = username or os.environ.get(
        "RESEARCH_ADMIN_USERNAME",
        "admin",
    )
    password = password or os.environ.get(
        "RESEARCH_ADMIN_PASSWORD",
        "admin",
    )

    user = db.query(User).filter(User.username == username).first()

    if user:
        if not user.is_admin:
            user.is_admin = True
            db.commit()
        return user

    user = User(
        username=username,
        email=f"{username}@research.local",
        password_hash=hash_password(password),
        is_admin=True,
    )
    db.add(user)

    try:
        db.commit()
    except IntegrityError:
        # Another request created it between our SELECT and INSERT.
        db.rollback()
        user = db.query(User).filter(User.username == username).first()

        if user is None:
            raise

    db.refresh(user)
    return user


def _get_secret(db: Session) -> str:
    env_secret = os.environ.get("RESEARCH_ADMIN_SECRET")

    if env_secret:
        return env_secret

    row = (
        db.query(SiteSetting)
        .filter(SiteSetting.key == _SECRET_KEY)
        .first()
    )

    if row:
        return row.value

    secret = secrets.token_hex(32)
    db.add(SiteSetting(key=_SECRET_KEY, value=secret))
    db.commit()
    return secret


def create_admin_token(db: Session, user_id: int) -> tuple[str, int]:
    """Sign `user_id.expiry` and return (token, unix expiry)."""
    secret = _get_secret(db)
    expires_at = int(time.time()) + TOKEN_TTL_SECONDS
    payload = f"{user_id}.{expires_at}"
    signature = hmac.new(
        secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload}.{signature}", expires_at


def verify_admin_token(db: Session, token: str) -> User | None:
    """Return the admin behind a valid, unexpired token, else None."""
    try:
        user_id_raw, expires_raw, signature = token.split(".")
        user_id = int(user_id_raw)
        expires_at = int(expires_raw)
    except (AttributeError, ValueError):
        return None

    if expires_at < int(time.time()):
        return None

    secret = _get_secret(db)
    expected = hmac.new(
        secret.encode("utf-8"),
        f"{user_id}.{expires_at}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        return None

    return (
        db.query(User)
        .filter(User.id == user_id, User.is_admin.is_(True))
        .first()
    )
