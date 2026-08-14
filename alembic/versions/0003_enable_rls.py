"""enable row-level security on tenant tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-14

Defense-in-depth for tenant isolation: even if the app-layer membership
check (app/api/deps.py get_current_workspace) has a bug, a raw query
against these tables cannot return rows the current session user (bound
via SET LOCAL app.user_id / app.user_email in app/core/db.py
set_actor_context, armed once per authenticated request) isn't entitled to.

Policies key off app.user_id via is_workspace_member(), a SECURITY DEFINER
helper function that queries workspace_members without RLS applied to its
own internal lookup (Postgres table owners bypass RLS on their own tables
by default). This avoids the circularity of a naive "check workspace_members
by querying workspace_members" policy, and the bootstrapping problem of not
knowing a server-generated workspace id before the first insert.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE FUNCTION is_workspace_member(p_workspace_id uuid, p_user_id uuid)
        RETURNS boolean
        LANGUAGE sql
        SECURITY DEFINER
        STABLE
        SET search_path = public
        AS $$
            SELECT EXISTS (
                SELECT 1 FROM workspace_members
                WHERE workspace_id = p_workspace_id AND user_id = p_user_id
            );
        $$
        """
    )

    # ── workspaces ────────────────────────────────────────────────────────
    # Visible if you're a member, OR you're the owner (covers the moment a
    # workspace is created, before any membership row necessarily commits
    # in the same statement ordering).
    op.execute("ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY workspace_select ON workspaces
        FOR SELECT
        USING (
            is_workspace_member(id, current_setting('app.user_id', true)::uuid)
            OR owner_id = current_setting('app.user_id', true)::uuid
        )
        """
    )
    op.execute(
        """
        CREATE POLICY workspace_insert ON workspaces
        FOR INSERT
        WITH CHECK (owner_id = current_setting('app.user_id', true)::uuid)
        """
    )
    op.execute(
        """
        CREATE POLICY workspace_update ON workspaces
        FOR UPDATE
        USING (is_workspace_member(id, current_setting('app.user_id', true)::uuid))
        WITH CHECK (is_workspace_member(id, current_setting('app.user_id', true)::uuid))
        """
    )

    # ── workspace_members ────────────────────────────────────────────────
    # Any current member can see the full member list of their workspace(s).
    # Insert is allowed either for yourself (workspace creation, invitation
    # acceptance) or by an existing member (future admin-adds-member flows).
    op.execute("ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY workspace_members_select ON workspace_members
        FOR SELECT
        USING (is_workspace_member(workspace_id, current_setting('app.user_id', true)::uuid))
        """
    )
    op.execute(
        """
        CREATE POLICY workspace_members_insert ON workspace_members
        FOR INSERT
        WITH CHECK (
            user_id = current_setting('app.user_id', true)::uuid
            OR is_workspace_member(workspace_id, current_setting('app.user_id', true)::uuid)
        )
        """
    )
    op.execute(
        """
        CREATE POLICY workspace_members_update ON workspace_members
        FOR UPDATE
        USING (is_workspace_member(workspace_id, current_setting('app.user_id', true)::uuid))
        WITH CHECK (is_workspace_member(workspace_id, current_setting('app.user_id', true)::uuid))
        """
    )
    op.execute(
        """
        CREATE POLICY workspace_members_delete ON workspace_members
        FOR DELETE
        USING (is_workspace_member(workspace_id, current_setting('app.user_id', true)::uuid))
        """
    )

    # ── workspace_invitations ────────────────────────────────────────────
    # Visible to existing members (to list pending invites) AND to the
    # invited email itself (so an about-to-become-member user can look up
    # and accept their own invitation before they have a membership row).
    op.execute("ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY workspace_invitations_select ON workspace_invitations
        FOR SELECT
        USING (
            is_workspace_member(workspace_id, current_setting('app.user_id', true)::uuid)
            OR email = current_setting('app.user_email', true)
        )
        """
    )
    op.execute(
        """
        CREATE POLICY workspace_invitations_insert ON workspace_invitations
        FOR INSERT
        WITH CHECK (is_workspace_member(workspace_id, current_setting('app.user_id', true)::uuid))
        """
    )
    op.execute(
        """
        CREATE POLICY workspace_invitations_update ON workspace_invitations
        FOR UPDATE
        USING (
            is_workspace_member(workspace_id, current_setting('app.user_id', true)::uuid)
            OR email = current_setting('app.user_email', true)
        )
        WITH CHECK (
            is_workspace_member(workspace_id, current_setting('app.user_id', true)::uuid)
            OR email = current_setting('app.user_email', true)
        )
        """
    )

    # ── audit_logs ───────────────────────────────────────────────────────
    # Platform-level rows (workspace_id IS NULL, e.g. user signup) are never
    # visible through the tenant-scoped connection — only queryable by
    # future platform_super_admin tooling that bypasses RLS entirely.
    op.execute("ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY audit_logs_select ON audit_logs
        FOR SELECT
        USING (
            workspace_id IS NOT NULL
            AND is_workspace_member(workspace_id, current_setting('app.user_id', true)::uuid)
        )
        """
    )
    op.execute(
        """
        CREATE POLICY audit_logs_insert ON audit_logs
        FOR INSERT
        WITH CHECK (
            workspace_id IS NULL
            OR is_workspace_member(workspace_id, current_setting('app.user_id', true)::uuid)
        )
        """
    )


def downgrade() -> None:
    for table in ("audit_logs", "workspace_invitations", "workspace_members", "workspaces"):
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    for table, policies in {
        "workspaces": ["workspace_select", "workspace_insert", "workspace_update"],
        "workspace_members": [
            "workspace_members_select",
            "workspace_members_insert",
            "workspace_members_update",
            "workspace_members_delete",
        ],
        "workspace_invitations": [
            "workspace_invitations_select",
            "workspace_invitations_insert",
            "workspace_invitations_update",
        ],
        "audit_logs": ["audit_logs_select", "audit_logs_insert"],
    }.items():
        for policy in policies:
            op.execute(f"DROP POLICY IF EXISTS {policy} ON {table}")
    op.execute("DROP FUNCTION IF EXISTS is_workspace_member(uuid, uuid)")
