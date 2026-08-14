import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

JWT_ALGORITHM = "HS256"


# ── Passwords ────────────────────────────────────────────────────────────
def hash_password(raw_password: str) -> str:
    return _pwd_context.hash(raw_password)


def verify_password(raw_password: str, password_hash: str) -> bool:
    return _pwd_context.verify(raw_password, password_hash)


# ── Access tokens (JWT) ──────────────────────────────────────────────────
# Deliberately carry no workspace_id/role — those are resolved server-side
# per request from workspace_members, so a role change or removal takes
# effect immediately without needing to revoke the access token itself.
def create_access_token(user_id: UUID, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_access_token_ttl_minutes),
        "jti": str(uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[JWT_ALGORITHM])
    except JWTError as exc:
        raise ValueError("Invalid or expired access token") from exc


# ── Refresh tokens (opaque, hashed at rest, rotated on use) ─────────────
def generate_refresh_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def refresh_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_token_ttl_days)


# ── Single-use tokens (email verification / password reset) ─────────────
def generate_single_use_token() -> str:
    return secrets.token_urlsafe(32)
