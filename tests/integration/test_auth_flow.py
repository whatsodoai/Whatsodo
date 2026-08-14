import pytest

from app.services import auth_service


@pytest.fixture
def captured_tokens(monkeypatch):
    """Auth emails go through the console EmailSender in tests (no real
    provider configured). Capture the raw token here instead of reading a
    real inbox — auth_service holds direct references to these functions.
    """
    captured = {}

    async def _fake_send_verification_email(to, token):
        captured["verify_token"] = token

    async def _fake_send_password_reset_email(to, token):
        captured["reset_token"] = token

    monkeypatch.setattr(auth_service, "send_verification_email", _fake_send_verification_email)
    monkeypatch.setattr(auth_service, "send_password_reset_email", _fake_send_password_reset_email)
    return captured


async def test_register_login_refresh_logout_flow(client, captured_tokens):
    register_resp = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "Ada Lovelace", "email": "ada@example.com", "password": "correct-horse-battery"},
    )
    assert register_resp.status_code == 201
    assert register_resp.json()["user"]["email_verified"] is False

    verify_resp = await client.post(
        "/api/v1/auth/verify-email", json={"token": captured_tokens["verify_token"]}
    )
    assert verify_resp.status_code == 200
    assert verify_resp.json()["user"]["email_verified"] is True

    login_resp = await client.post(
        "/api/v1/auth/login", json={"email": "ada@example.com", "password": "correct-horse-battery"}
    )
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.cookies
    assert "refresh_token" in login_resp.cookies

    me_resp = await client.get("/api/v1/auth/me")
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "ada@example.com"

    old_refresh_cookie = client.cookies["refresh_token"]
    refresh_resp = await client.post("/api/v1/auth/refresh")
    assert refresh_resp.status_code == 200
    assert client.cookies["refresh_token"] != old_refresh_cookie

    logout_resp = await client.post("/api/v1/auth/logout")
    assert logout_resp.status_code == 204

    me_after_logout = await client.get("/api/v1/auth/me")
    assert me_after_logout.status_code == 401


async def test_login_rejects_wrong_password(client, captured_tokens):
    await client.post(
        "/api/v1/auth/register",
        json={"full_name": "Grace Hopper", "email": "grace@example.com", "password": "correct-horse-battery"},
    )
    resp = await client.post("/api/v1/auth/login", json={"email": "grace@example.com", "password": "wrong-password"})
    assert resp.status_code == 401


async def test_refresh_token_reuse_revokes_family(client, captured_tokens):
    await client.post(
        "/api/v1/auth/register",
        json={"full_name": "Alan Turing", "email": "alan@example.com", "password": "correct-horse-battery"},
    )
    await client.post("/api/v1/auth/login", json={"email": "alan@example.com", "password": "correct-horse-battery"})

    stolen_refresh_token = client.cookies["refresh_token"]

    # Legitimate rotation — this revokes stolen_refresh_token server-side.
    first_refresh = await client.post("/api/v1/auth/refresh")
    assert first_refresh.status_code == 200

    # Attacker replays the now-revoked (already-rotated) token.
    client.cookies.set("refresh_token", stolen_refresh_token)
    reuse_resp = await client.post("/api/v1/auth/refresh")
    assert reuse_resp.status_code == 401

    # The legitimate rotated token should now also be revoked (whole family
    # theft-detection), so even the "good" chain can't continue silently.
    client.cookies.set("refresh_token", client.cookies.get("refresh_token"))
    second_refresh = await client.post("/api/v1/auth/refresh")
    assert second_refresh.status_code == 401


async def test_password_reset_flow(client, captured_tokens):
    await client.post(
        "/api/v1/auth/register",
        json={"full_name": "Margaret Hamilton", "email": "margaret@example.com", "password": "old-password-123"},
    )
    await client.post("/api/v1/auth/forgot-password", json={"email": "margaret@example.com"})
    assert "reset_token" in captured_tokens

    reset_resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": captured_tokens["reset_token"], "new_password": "new-password-456"},
    )
    assert reset_resp.status_code == 204

    old_login = await client.post(
        "/api/v1/auth/login", json={"email": "margaret@example.com", "password": "old-password-123"}
    )
    assert old_login.status_code == 401

    new_login = await client.post(
        "/api/v1/auth/login", json={"email": "margaret@example.com", "password": "new-password-456"}
    )
    assert new_login.status_code == 200
