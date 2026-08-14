import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.core.rbac import WorkspaceRole


class WorkspaceCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class WorkspaceOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    owner_id: uuid.UUID
    onboarding_step: str | None
    role: WorkspaceRole | None = None  # the caller's own role, filled in per-request

    model_config = {"from_attributes": True}


class WorkspaceMemberOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    email: str
    full_name: str
    role: WorkspaceRole
    joined_at: datetime

    model_config = {"from_attributes": True}


class InviteMemberRequest(BaseModel):
    email: EmailStr
    role: WorkspaceRole


class AcceptInvitationRequest(BaseModel):
    token: str


class ChangeRoleRequest(BaseModel):
    role: WorkspaceRole


class WorkspaceInvitationOut(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    email: str
    role: WorkspaceRole
    status: str
    expires_at: datetime

    model_config = {"from_attributes": True}
