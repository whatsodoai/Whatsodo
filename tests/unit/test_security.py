import uuid

import pytest

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    hash_token,
    verify_password,
)


def test_password_hash_roundtrip():
    hashed = hash_password("correct-horse-battery")
    assert verify_password("correct-horse-battery", hashed)
    assert not verify_password("wrong-password", hashed)


def test_password_hash_is_not_plaintext():
    hashed = hash_password("correct-horse-battery")
    assert hashed != "correct-horse-battery"


def test_access_token_roundtrip():
    user_id = uuid.uuid4()
    token = create_access_token(user_id, "user@example.com")
    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["email"] == "user@example.com"


def test_access_token_rejects_tampering():
    token = create_access_token(uuid.uuid4(), "user@example.com")
    tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
    with pytest.raises(ValueError):
        decode_access_token(tampered)


def test_token_hash_is_deterministic_but_not_reversible():
    raw = "some-refresh-token-value"
    assert hash_token(raw) == hash_token(raw)
    assert hash_token(raw) != raw
