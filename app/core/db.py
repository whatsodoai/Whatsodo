from collections.abc import AsyncGenerator
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(settings.database_url, pool_pre_ping=True, echo=False)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session


async def set_actor_context(session: AsyncSession, user_id: UUID, email: str) -> None:
    """Binds the current transaction to the authenticated user for Postgres
    RLS, via SET LOCAL (transaction-scoped, can't leak across requests even
    on a pooled connection). Called once per authenticated request, right
    after JWT verification in app/api/deps.py get_current_user.

    RLS policies on workspaces/workspace_members/workspace_invitations key
    off app.user_id (via the is_workspace_member() SQL function — see
    migration 0003) rather than a pre-resolved app.workspace_id, because the
    membership table can't safely use a workspace-keyed policy without
    circularity: you'd need to already know you're a member to look up
    whether you're a member.
    """
    await session.execute(text("SET LOCAL app.user_id = :user_id"), {"user_id": str(user_id)})
    await session.execute(text("SET LOCAL app.user_email = :email"), {"email": email})


async def set_tenant_context(session: AsyncSession, workspace_id: UUID) -> None:
    """Binds the current transaction to a specific workspace for Postgres
    RLS. Used by app/api/deps.py get_current_workspace once membership has
    already been validated at the app layer. Not used by Phase 1's own
    tables (see set_actor_context) but armed for later-phase CRM tables
    (contacts, leads, etc.) that can safely use a simple
    `workspace_id = current_setting('app.workspace_id')` policy, since
    those tables aren't the membership table itself and don't have the
    bootstrapping problem.
    """
    await session.execute(text("SET LOCAL app.workspace_id = :workspace_id"), {"workspace_id": str(workspace_id)})
