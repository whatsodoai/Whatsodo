from enum import Enum


class WorkspaceRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MANAGER = "manager"
    AGENT = "agent"
    VIEWER = "viewer"


class Permission(str, Enum):
    WORKSPACE_VIEW = "workspace:view"
    WORKSPACE_EDIT_SETTINGS = "workspace:edit_settings"
    WORKSPACE_MANAGE_MEMBERS = "workspace:manage_members"
    WORKSPACE_DELETE = "workspace:delete"


# Single source of truth for role → permission mapping. Kept as an in-code
# matrix (not a DB table) since Phase 1 has no product requirement for
# custom roles — but every call site goes through require_permission(), so
# moving this to a DB-backed table later doesn't change any endpoint code.
ROLE_PERMISSIONS: dict[WorkspaceRole, set[Permission]] = {
    WorkspaceRole.OWNER: {
        Permission.WORKSPACE_VIEW,
        Permission.WORKSPACE_EDIT_SETTINGS,
        Permission.WORKSPACE_MANAGE_MEMBERS,
        Permission.WORKSPACE_DELETE,
    },
    WorkspaceRole.ADMIN: {
        Permission.WORKSPACE_VIEW,
        Permission.WORKSPACE_EDIT_SETTINGS,
        Permission.WORKSPACE_MANAGE_MEMBERS,
    },
    WorkspaceRole.MANAGER: {
        Permission.WORKSPACE_VIEW,
    },
    WorkspaceRole.AGENT: {
        Permission.WORKSPACE_VIEW,
    },
    WorkspaceRole.VIEWER: {
        Permission.WORKSPACE_VIEW,
    },
}


def role_has_permission(role: WorkspaceRole, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, set())
