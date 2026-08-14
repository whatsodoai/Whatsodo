from sqlalchemy import select

from app.core.db import set_actor_context
from app.core.security import hash_password
from app.models.user import User
from app.models.workspace import Workspace
from app.services import workspace_service


async def test_rls_blocks_cross_tenant_read_even_without_app_layer_filter(db_session):
    """Defense-in-depth gate (SOP §3 / Phase 1 Milestone 6): simulates an
    app-layer bug by issuing a *raw* query with no workspace_id ownership
    check at all — just `SELECT * FROM workspaces WHERE id = :id`, the kind
    of query a buggy endpoint might accidentally write. Even then, Postgres
    RLS must return zero rows for a workspace the current session user
    doesn't belong to.
    """
    owner = User(email="rls-owner@example.com", password_hash=hash_password("x"), full_name="Owner")
    stranger = User(email="rls-stranger@example.com", password_hash=hash_password("x"), full_name="Stranger")
    db_session.add_all([owner, stranger])
    await db_session.flush()

    await set_actor_context(db_session, owner.id, owner.email)
    workspace = await workspace_service.create_workspace(db_session, owner=owner, name="Private Workspace")

    # Switch the session's RLS identity to the stranger — no app-layer
    # workspace_id filter is applied here at all, deliberately.
    await set_actor_context(db_session, stranger.id, stranger.email)

    result = await db_session.execute(select(Workspace).where(Workspace.id == workspace.id))
    assert result.scalar_one_or_none() is None, "RLS failed to block a cross-tenant raw read"

    from app.models.workspace_member import WorkspaceMember

    members_result = await db_session.execute(
        select(WorkspaceMember).where(WorkspaceMember.workspace_id == workspace.id)
    )
    assert members_result.scalars().all() == [], "RLS failed to block cross-tenant member list read"


async def test_rls_allows_owner_to_read_own_workspace_raw(db_session):
    owner = User(email="rls-owner2@example.com", password_hash=hash_password("x"), full_name="Owner2")
    db_session.add(owner)
    await db_session.flush()

    await set_actor_context(db_session, owner.id, owner.email)
    workspace = await workspace_service.create_workspace(db_session, owner=owner, name="My Own Workspace")

    result = await db_session.execute(select(Workspace).where(Workspace.id == workspace.id))
    assert result.scalar_one_or_none() is not None
