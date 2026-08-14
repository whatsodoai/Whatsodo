from app.core.rbac import Permission, WorkspaceRole, role_has_permission


def test_viewer_cannot_manage_members():
    assert not role_has_permission(WorkspaceRole.VIEWER, Permission.WORKSPACE_MANAGE_MEMBERS)


def test_agent_cannot_manage_members():
    assert not role_has_permission(WorkspaceRole.AGENT, Permission.WORKSPACE_MANAGE_MEMBERS)


def test_manager_cannot_manage_members():
    assert not role_has_permission(WorkspaceRole.MANAGER, Permission.WORKSPACE_MANAGE_MEMBERS)


def test_admin_can_manage_members():
    assert role_has_permission(WorkspaceRole.ADMIN, Permission.WORKSPACE_MANAGE_MEMBERS)


def test_owner_can_manage_members():
    assert role_has_permission(WorkspaceRole.OWNER, Permission.WORKSPACE_MANAGE_MEMBERS)


def test_only_owner_can_delete_workspace():
    for role in WorkspaceRole:
        expected = role == WorkspaceRole.OWNER
        assert role_has_permission(role, Permission.WORKSPACE_DELETE) == expected


def test_every_role_can_view():
    for role in WorkspaceRole:
        assert role_has_permission(role, Permission.WORKSPACE_VIEW)
