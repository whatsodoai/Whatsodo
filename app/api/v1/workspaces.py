import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentWorkspace, get_current_user, require_permission
from app.core.db import get_db
from app.core.rbac import Permission
from app.models.user import User
from app.models.workspace import Workspace
from app.schemas.workspace import (
    AcceptInvitationRequest,
    ChangeRoleRequest,
    InviteMemberRequest,
    WorkspaceCreateRequest,
    WorkspaceInvitationOut,
    WorkspaceMemberOut,
    WorkspaceOut,
)
from app.services import workspace_service

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.post("", response_model=WorkspaceOut, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    payload: WorkspaceCreateRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> WorkspaceOut:
    workspace = await workspace_service.create_workspace(db, owner=user, name=payload.name)
    out = WorkspaceOut.model_validate(workspace)
    out.role = "owner"  # type: ignore[assignment]
    return out


@router.get("", response_model=list[WorkspaceOut])
async def list_my_workspaces(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[WorkspaceOut]:
    rows = await workspace_service.list_user_workspaces(db, user.id)
    results = []
    for workspace, role in rows:
        out = WorkspaceOut.model_validate(workspace)
        out.role = role
        results.append(out)
    return results


@router.get("/{workspace_id}", response_model=WorkspaceOut)
async def get_workspace(
    workspace_id: uuid.UUID,
    ws: CurrentWorkspace = Depends(require_permission(Permission.WORKSPACE_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceOut:
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workspace not found")

    out = WorkspaceOut.model_validate(workspace)
    out.role = ws.role
    return out


@router.get("/{workspace_id}/members", response_model=list[WorkspaceMemberOut])
async def list_members(
    workspace_id: uuid.UUID,
    ws: CurrentWorkspace = Depends(require_permission(Permission.WORKSPACE_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> list[WorkspaceMemberOut]:
    rows = await workspace_service.list_workspace_members(db, workspace_id)
    return [
        WorkspaceMemberOut(
            id=member.id,
            user_id=member.user_id,
            email=user.email,
            full_name=user.full_name,
            role=member.role,
            joined_at=member.joined_at,
        )
        for member, user in rows
    ]


@router.post("/{workspace_id}/invitations", response_model=WorkspaceInvitationOut, status_code=status.HTTP_201_CREATED)
async def invite_member(
    workspace_id: uuid.UUID,
    payload: InviteMemberRequest,
    ws: CurrentWorkspace = Depends(require_permission(Permission.WORKSPACE_MANAGE_MEMBERS)),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceInvitationOut:
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    workspace = result.scalar_one()

    invitation = await workspace_service.invite_member(
        db, workspace=workspace, inviter=user, email=payload.email, role=payload.role
    )
    return WorkspaceInvitationOut.model_validate(invitation)


@router.post("/invitations/accept", response_model=WorkspaceOut)
async def accept_invitation(
    payload: AcceptInvitationRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> WorkspaceOut:
    workspace = await workspace_service.accept_invitation(db, user=user, raw_token=payload.token)
    role = await workspace_service.get_member_role(db, workspace_id=workspace.id, user_id=user.id)
    out = WorkspaceOut.model_validate(workspace)
    out.role = role
    return out


@router.patch("/{workspace_id}/members/{target_user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def change_member_role(
    workspace_id: uuid.UUID,
    target_user_id: uuid.UUID,
    payload: ChangeRoleRequest,
    ws: CurrentWorkspace = Depends(require_permission(Permission.WORKSPACE_MANAGE_MEMBERS)),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await workspace_service.change_member_role(
        db, workspace_id=workspace_id, target_user_id=target_user_id, new_role=payload.role, actor=user
    )


@router.delete("/{workspace_id}/members/{target_user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    workspace_id: uuid.UUID,
    target_user_id: uuid.UUID,
    ws: CurrentWorkspace = Depends(require_permission(Permission.WORKSPACE_MANAGE_MEMBERS)),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await workspace_service.remove_member(db, workspace_id=workspace_id, target_user_id=target_user_id, actor=user)
