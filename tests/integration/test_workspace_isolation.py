import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
def captured_tokens(monkeypatch):
    from app.services import auth_service

    captured = {}

    async def _fake_send_verification_email(to, token):
        captured[to] = token

    monkeypatch.setattr(auth_service, "send_verification_email", _fake_send_verification_email)
    return captured


async def _register_and_login(client: AsyncClient, captured_tokens: dict, *, email: str, name: str) -> None:
    await client.post("/api/v1/auth/register", json={"full_name": name, "email": email, "password": "correct-horse-battery"})
    await client.post("/api/v1/auth/verify-email", json={"token": captured_tokens[email]})
    await client.post("/api/v1/auth/login", json={"email": email, "password": "correct-horse-battery"})


@pytest.fixture
async def second_client(client):
    """A second AsyncClient with its own cookie jar, sharing the same
    dependency-overridden app/db so both users act within the same test
    transaction.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


async def test_stranger_cannot_read_another_workspace(client, second_client, captured_tokens):
    """Release-blocking gate (SOP §3 / Phase 1 Milestone 4): a user with a
    valid session token, who knows or guesses another workspace's real
    UUID, must never be able to read or modify that workspace's data.
    """
    await _register_and_login(client, captured_tokens, email="owner@example.com", name="Owner")
    create_resp = await client.post("/api/v1/workspaces", json={"name": "Owner's Workspace"})
    assert create_resp.status_code == 201
    workspace_id = create_resp.json()["id"]

    await _register_and_login(second_client, captured_tokens, email="stranger@example.com", name="Stranger")

    get_resp = await second_client.get(f"/api/v1/workspaces/{workspace_id}")
    assert get_resp.status_code == 403

    members_resp = await second_client.get(f"/api/v1/workspaces/{workspace_id}/members")
    assert members_resp.status_code == 403

    invite_resp = await second_client.post(
        f"/api/v1/workspaces/{workspace_id}/invitations", json={"email": "friend@example.com", "role": "agent"}
    )
    assert invite_resp.status_code == 403


async def test_owner_can_read_own_workspace(client, captured_tokens):
    await _register_and_login(client, captured_tokens, email="solo@example.com", name="Solo")
    create_resp = await client.post("/api/v1/workspaces", json={"name": "Solo's Workspace"})
    workspace_id = create_resp.json()["id"]

    get_resp = await client.get(f"/api/v1/workspaces/{workspace_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["role"] == "owner"

    members_resp = await client.get(f"/api/v1/workspaces/{workspace_id}/members")
    assert members_resp.status_code == 200
    assert len(members_resp.json()) == 1


async def test_viewer_cannot_invite_members(client, second_client, captured_tokens, db_session):
    """RBAC gate: role is always re-derived server-side from
    workspace_members, never trusted from the request."""
    await _register_and_login(client, captured_tokens, email="admin2@example.com", name="Admin")
    create_resp = await client.post("/api/v1/workspaces", json={"name": "Team Workspace"})
    workspace_id = create_resp.json()["id"]

    # Directly seed a viewer membership for a second user (simulating an
    # already-accepted invite) to test the permission boundary in isolation.
    await _register_and_login(second_client, captured_tokens, email="viewer@example.com", name="Viewer")

    from app.core.rbac import WorkspaceRole
    from app.models.user import User
    from app.models.workspace_member import WorkspaceMember
    from sqlalchemy import select

    result = await db_session.execute(select(User).where(User.email == "viewer@example.com"))
    viewer_user = result.scalar_one()
    db_session.add(WorkspaceMember(workspace_id=workspace_id, user_id=viewer_user.id, role=WorkspaceRole.VIEWER))
    await db_session.commit()

    invite_resp = await second_client.post(
        f"/api/v1/workspaces/{workspace_id}/invitations", json={"email": "someone@example.com", "role": "agent"}
    )
    assert invite_resp.status_code == 403

    view_resp = await second_client.get(f"/api/v1/workspaces/{workspace_id}")
    assert view_resp.status_code == 200
