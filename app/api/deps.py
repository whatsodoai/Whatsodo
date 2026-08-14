import uuid
from collections.abc import Callable

from fastapi import Cookie, Depends, HTTPException, Path, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db, set_actor_context, set_tenant_context
from app.core.logging import user_id_ctx, workspace_id_ctx
from app.core.rbac import Permission, WorkspaceRole, role_has_permission
from app.core.security import decode_access_token
from app.models.user import User
from app.models.workspace_member import WorkspaceMember

ACCESS_TOKEN_COOKIE = "access_token"


async def get_current_user(
    access_token: str | None = Cookie(default=None, alias=ACCESS_TOKEN_COOKIE),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not access_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_access_token(access_token)
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session") from exc

    user_id = uuid.UUID(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account not found or disabled")

    await set_actor_context(db, user.id, user.email)
    user_id_ctx.set(str(user.id))
    return user


class CurrentWorkspace:
    def __init__(self, workspace_id: uuid.UUID, role: WorkspaceRole):
        self.workspace_id = workspace_id
        self.role = role


async def get_current_workspace(
    workspace_id: uuid.UUID = Path(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CurrentWorkspace:
    """Resolves workspace_id from the URL path (never a client header/body,
    so it can't be spoofed independently of the membership check) and
    verifies the caller has an active membership row for it. This is the
    mandatory app-layer half of tenant isolation — every tenant-scoped
    route must depend on this. The DB-layer half (Postgres RLS) is armed
    by set_tenant_context() below for the duration of this request's
    transaction, as defense-in-depth against a bug in this layer alone.
    """
    result = await db.execute(
        select(WorkspaceMember.role).where(
            WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user.id
        )
    )
    role = result.scalar_one_or_none()
    if role is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this workspace")

    await set_tenant_context(db, workspace_id)
    workspace_id_ctx.set(str(workspace_id))
    return CurrentWorkspace(workspace_id=workspace_id, role=role)


def require_permission(permission: Permission) -> Callable:
    async def _check(workspace: CurrentWorkspace = Depends(get_current_workspace)) -> CurrentWorkspace:
        if not role_has_permission(workspace.role, permission):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to perform this action")
        return workspace

    return _check
