import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    generate_refresh_token,
    generate_single_use_token,
    hash_password,
    hash_token,
    refresh_token_expiry,
    verify_password,
)
from app.models.email_verification import EmailVerification
from app.models.password_reset import PasswordReset
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.services.audit_service import record_audit_event
from app.services.email_service import send_password_reset_email, send_verification_email

EMAIL_VERIFICATION_TTL = timedelta(hours=24)
PASSWORD_RESET_TTL = timedelta(hours=1)


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def register_user(db: AsyncSession, *, full_name: str, email: str, password: str) -> User:
    existing = await get_user_by_email(db, email)
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

    user = User(full_name=full_name, email=email, password_hash=hash_password(password))
    db.add(user)
    await db.flush()

    raw_token = generate_single_use_token()
    db.add(
        EmailVerification(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=datetime.now(timezone.utc) + EMAIL_VERIFICATION_TTL,
        )
    )
    await record_audit_event(db, action="auth.register", actor_user_id=user.id)
    await db.commit()

    await send_verification_email(user.email, raw_token)
    return user


async def verify_email(db: AsyncSession, raw_token: str) -> User:
    token_hash = hash_token(raw_token)
    result = await db.execute(select(EmailVerification).where(EmailVerification.token_hash == token_hash))
    record = result.scalar_one_or_none()

    if not record or record.used_at is not None or record.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired verification token")

    result = await db.execute(select(User).where(User.id == record.user_id))
    user = result.scalar_one()
    user.email_verified_at = datetime.now(timezone.utc)
    record.used_at = datetime.now(timezone.utc)

    await record_audit_event(db, action="auth.email_verified", actor_user_id=user.id)
    await db.commit()
    return user


async def authenticate_user(db: AsyncSession, *, email: str, password: str) -> User:
    user = await get_user_by_email(db, email)
    if not user or not user.password_hash or not verify_password(password, user.password_hash):
        await record_audit_event(db, action="auth.login_failed", metadata={"email": email})
        await db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")

    user.last_login_at = datetime.now(timezone.utc)
    await record_audit_event(db, action="auth.login", actor_user_id=user.id)
    await db.commit()
    return user


async def issue_refresh_token(
    db: AsyncSession, *, user_id: uuid.UUID, family_id: uuid.UUID | None = None, user_agent: str | None = None
) -> str:
    raw_token = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user_id,
            token_hash=hash_token(raw_token),
            family_id=family_id or uuid.uuid4(),
            expires_at=refresh_token_expiry(),
            user_agent=user_agent,
        )
    )
    await db.commit()
    return raw_token


async def rotate_refresh_token(db: AsyncSession, raw_token: str) -> tuple[User, str]:
    """Validates + rotates a refresh token. Reuse of an already-rotated
    (revoked) token revokes the entire token family — theft-detection.
    """
    token_hash = hash_token(raw_token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")

    if record.revoked_at is not None:
        # Reused token — revoke the whole family.
        family_result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.family_id == record.family_id, RefreshToken.revoked_at.is_(None)
            )
        )
        for member in family_result.scalars():
            member.revoked_at = datetime.now(timezone.utc)
        await record_audit_event(
            db, action="auth.refresh_token_reuse_detected", actor_user_id=record.user_id
        )
        await db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token has been revoked")

    if record.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token expired")

    result = await db.execute(select(User).where(User.id == record.user_id))
    user = result.scalar_one()

    new_raw_token = generate_refresh_token()
    new_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(new_raw_token),
        family_id=record.family_id,
        expires_at=refresh_token_expiry(),
    )
    db.add(new_record)
    await db.flush()

    record.revoked_at = datetime.now(timezone.utc)
    record.replaced_by_id = new_record.id

    await db.commit()
    return user, new_raw_token


async def revoke_refresh_token(db: AsyncSession, raw_token: str) -> None:
    token_hash = hash_token(raw_token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    record = result.scalar_one_or_none()
    if record and record.revoked_at is None:
        record.revoked_at = datetime.now(timezone.utc)
        await db.commit()


async def request_password_reset(db: AsyncSession, email: str) -> None:
    user = await get_user_by_email(db, email)
    if not user:
        # Don't reveal whether the email exists.
        return

    raw_token = generate_single_use_token()
    db.add(
        PasswordReset(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=datetime.now(timezone.utc) + PASSWORD_RESET_TTL,
        )
    )
    await record_audit_event(db, action="auth.password_reset_requested", actor_user_id=user.id)
    await db.commit()

    await send_password_reset_email(user.email, raw_token)


async def reset_password(db: AsyncSession, *, raw_token: str, new_password: str) -> None:
    token_hash = hash_token(raw_token)
    result = await db.execute(select(PasswordReset).where(PasswordReset.token_hash == token_hash))
    record = result.scalar_one_or_none()

    if not record or record.used_at is not None or record.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired reset token")

    result = await db.execute(select(User).where(User.id == record.user_id))
    user = result.scalar_one()
    user.password_hash = hash_password(new_password)
    record.used_at = datetime.now(timezone.utc)

    # Revoke all outstanding refresh tokens on password reset.
    tokens_result = await db.execute(
        select(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
    )
    for token in tokens_result.scalars():
        token.revoked_at = datetime.now(timezone.utc)

    await record_audit_event(db, action="auth.password_reset_completed", actor_user_id=user.id)
    await db.commit()
