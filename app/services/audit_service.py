import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


async def record_audit_event(
    db: AsyncSession,
    *,
    action: str,
    actor_user_id: uuid.UUID | None = None,
    workspace_id: uuid.UUID | None = None,
    target_type: str | None = None,
    target_id: uuid.UUID | None = None,
    metadata: dict | None = None,
    ip_address: str | None = None,
) -> None:
    db.add(
        AuditLog(
            action=action,
            actor_user_id=actor_user_id,
            workspace_id=workspace_id,
            target_type=target_type,
            target_id=target_id,
            log_metadata=metadata or {},
            ip_address=ip_address,
        )
    )
