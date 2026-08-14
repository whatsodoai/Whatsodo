from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import ACCESS_TOKEN_COOKIE, get_current_user
from app.core.config import get_settings
from app.core.db import get_db
from app.core.security import create_access_token
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    UserOut,
    VerifyEmailRequest,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

REFRESH_TOKEN_COOKIE = "refresh_token"


def _cookie_kwargs(max_age_seconds: int) -> dict:
    return {
        "httponly": True,
        "secure": settings.is_production,
        "samesite": "lax",
        "domain": settings.cookie_domain if settings.cookie_domain != "localhost" else None,
        "max_age": max_age_seconds,
        "path": "/",
    }


def _set_auth_cookies(response: Response, *, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        ACCESS_TOKEN_COOKIE, access_token, **_cookie_kwargs(settings.jwt_access_token_ttl_minutes * 60)
    )
    response.set_cookie(
        REFRESH_TOKEN_COOKIE, refresh_token, **_cookie_kwargs(settings.jwt_refresh_token_ttl_days * 86400)
    )


def _to_user_out(user) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        email_verified=user.email_verified_at is not None,
        is_platform_super_admin=user.is_platform_super_admin,
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    user = await auth_service.register_user(
        db, full_name=payload.full_name, email=payload.email, password=payload.password
    )
    return AuthResponse(user=_to_user_out(user))


@router.post("/verify-email", response_model=AuthResponse)
async def verify_email(payload: VerifyEmailRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    user = await auth_service.verify_email(db, payload.token)
    return AuthResponse(user=_to_user_out(user))


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    user = await auth_service.authenticate_user(db, email=payload.email, password=payload.password)
    access_token = create_access_token(user.id, user.email)
    refresh_token = await auth_service.issue_refresh_token(db, user_id=user.id)
    _set_auth_cookies(response, access_token=access_token, refresh_token=refresh_token)
    return AuthResponse(user=_to_user_out(user))


@router.post("/refresh", response_model=AuthResponse)
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_TOKEN_COOKIE),
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    if not refresh_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No refresh token provided")

    user, new_refresh_token = await auth_service.rotate_refresh_token(db, refresh_token)
    access_token = create_access_token(user.id, user.email)
    _set_auth_cookies(response, access_token=access_token, refresh_token=new_refresh_token)
    return AuthResponse(user=_to_user_out(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_TOKEN_COOKIE),
    db: AsyncSession = Depends(get_db),
) -> None:
    if refresh_token:
        await auth_service.revoke_refresh_token(db, refresh_token)
    response.delete_cookie(ACCESS_TOKEN_COOKIE, path="/")
    response.delete_cookie(REFRESH_TOKEN_COOKIE, path="/")


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)) -> None:
    await auth_service.request_password_reset(db, payload.email)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)) -> None:
    await auth_service.reset_password(db, raw_token=payload.token, new_password=payload.new_password)


@router.get("/me", response_model=UserOut)
async def me(user=Depends(get_current_user)) -> UserOut:
    return _to_user_out(user)
