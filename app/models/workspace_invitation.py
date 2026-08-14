import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import CITEXT, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.rbac import WorkspaceRole
from app.models.base import TimestampedBase
from app.models.workspace_member import workspace_role_enum


class InvitationStatus(str, PyEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REVOKED = "revoked"
    EXPIRED = "expired"


invitation_status_enum = Enum(
    InvitationStatus, name="invitation_status", values_callable=lambda e: [m.value for m in e]
)


class WorkspaceInvitation(TimestampedBase):
    __tablename__ = "workspace_invitations"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(CITEXT, nullable=False)
    role: Mapped[WorkspaceRole] = mapped_column(workspace_role_enum, nullable=False)
    invited_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(Text, unique=True, nullable=False, index=True)
    status: Mapped[InvitationStatus] = mapped_column(
        invitation_status_enum, nullable=False, default=InvitationStatus.PENDING
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
