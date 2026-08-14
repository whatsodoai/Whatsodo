import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import WorkspaceRole
from app.core.security import generate_single_use_token, hash_token
from app.models.user import User
from app.models.workspace import Workspace
from app.models.workspace_invitation import InvitationStatus, WorkspaceInvitation
from app.models.workspace_member import WorkspaceMember
from app.services.audit_service import record_audit_event
from app.services.email_service import send_workspace_invitation_email

INVITATION_TTL = timedelta(days=7)


def _slugify(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "workspace"
    return f"{base}-{secrets.token_hex(3)}"


async def create_workspace(db: AsyncSession, *, owner: User, name: str) -> Workspace:
    # RLS on workspaces/workspace_members keys off app.user_id (see
    # app/core/db.py set_actor_context, armed once per request in
    # get_current_user), checked via the is_workspace_member() SQL function
    # or an owner_id/user_id self-match — no per-workspace context needed
    # here, which sidesteps the chicken-and-egg problem of not yet knowing
    # a server-generated workspace id before insert.
    workspace = Workspace(name=name, slug=_slugify(name), owner_id=owner.id, onboarding_step="workspace_created")
    db.add(workspace)
    await db.flush()

    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=owner.id, role=WorkspaceRole.OWNER))
    # Flush before the audit log insert: audit_logs' RLS WITH CHECK requires
    # is_workspace_member() to see this membership row already applied
    # within the transaction (uncommitted writes are visible to the same
    # session, but only once actually sent to the server via flush).
    await db.flush()
    await record_audit_event(
        db, action="workspace.created", actor_user_id=owner.id, workspace_id=workspace.id
    )
    await db.commit()
    await db.refresh(workspace)
    return workspace


async def list_user_workspaces(db: AsyncSession, user_id: uuid.UUID) -> list[tuple[Workspace, WorkspaceRole]]:
    result = await db.execute(
        select(Workspace, WorkspaceMember.role)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == user_id, Workspace.is_active.is_(True))
    )
    return [(row[0], row[1]) for row in result.all()]


async def get_member_role(db: AsyncSession, *, workspace_id: uuid.UUID, user_id: uuid.UUID) -> WorkspaceRole | None:
    result = await db.execute(
        select(WorkspaceMember.role).where(
            WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user_id
        )
    )
    row = result.scalar_one_or_none()
    return row


async def list_workspace_members(db: AsyncSession, workspace_id: uuid.UUID):
    result = await db.execute(
        select(WorkspaceMember, User)
        .join(User, User.id == WorkspaceMember.user_id)
        .where(WorkspaceMember.workspace_id == workspace_id)
    )
    return result.all()


async def invite_member(
    db: AsyncSession, *, workspace: Workspace, inviter: User, email: str, role: WorkspaceRole
) -> WorkspaceInvitation:
    raw_token = generate_single_use_token()
    invitation = WorkspaceInvitation(
        workspace_id=workspace.id,
        email=email,
        role=role,
        invited_by=inviter.id,
        token_hash=hash_token(raw_token),
        status=InvitationStatus.PENDING,
        expires_at=datetime.now(timezone.utc) + INVITATION_TTL,
    )
    db.add(invitation)
    await record_audit_event(
        db,
        action="workspace.member.invited",
        actor_user_id=inviter.id,
        workspace_id=workspace.id,
        target_type="workspace_invitation",
        metadata={"email": email, "role": role.value},
    )
    await db.commit()
    await db.refresh(invitation)

    await send_workspace_invitation_email(email, workspace.name, raw_token)
    return invitation


async def accept_invitation(db: AsyncSession, *, user: User, raw_token: str) -> Workspace:
    token_hash = hash_token(raw_token)
    result = await db.execute(select(WorkspaceInvitation).where(WorkspaceInvitation.token_hash == token_hash))
    invitation = result.scalar_one_or_none()

    if not invitation or invitation.status != InvitationStatus.PENDING:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or already-used invitation")
    if invitation.expires_at < datetime.now(timezone.utc):
        invitation.status = InvitationStatus.EXPIRED
        await db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invitation has expired")
    if invitation.email.lower() != user.email.lower():
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This invitation was sent to a different email address")

    existing = await get_member_role(db, workspace_id=invitation.workspace_id, user_id=user.id)
    if existing is None:
        db.add(
            WorkspaceMember(
                workspace_id=invitation.workspace_id,
                user_id=user.id,
                role=invitation.role,
                invited_by=invitation.invited_by,
            )
        )

    invitation.status = InvitationStatus.ACCEPTED
    invitation.accepted_at = datetime.now(timezone.utc)

    # Flush so the new membership row is visible to is_workspace_member()
    # before the audit_logs RLS WITH CHECK evaluates it (see create_workspace
    # for the same pattern).
    await db.flush()
    await record_audit_event(
        db,
        action="workspace.member.joined",
        actor_user_id=user.id,
        workspace_id=invitation.workspace_id,
        metadata={"role": invitation.role.value},
    )
    await db.commit()

    result = await db.execute(select(Workspace).where(Workspace.id == invitation.workspace_id))
    return result.scalar_one()


async def change_member_role(
    db: AsyncSession, *, workspace_id: uuid.UUID, target_user_id: uuid.UUID, new_role: WorkspaceRole, actor: User
) -> None:
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == target_user_id
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found in this workspace")

    old_role = member.role
    member.role = new_role
    await record_audit_event(
        db,
        action="workspace.member.role_changed",
        actor_user_id=actor.id,
        workspace_id=workspace_id,
        target_type="workspace_member",
        target_id=member.id,
        metadata={"old_role": old_role.value, "new_role": new_role.value},
    )
    await db.commit()


async def remove_member(db: AsyncSession, *, workspace_id: uuid.UUID, target_user_id: uuid.UUID, actor: User) -> None:
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == target_user_id
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found in this workspace")
    if member.role == WorkspaceRole.OWNER:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot remove the workspace owner")

    await db.delete(member)
    await record_audit_event(
        db,
        action="workspace.member.removed",
        actor_user_id=actor.id,
        workspace_id=workspace_id,
        target_type="workspace_member",
        metadata={"removed_user_id": str(target_user_id)},
    )
    await db.commit()
