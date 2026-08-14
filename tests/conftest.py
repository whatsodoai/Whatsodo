import os
import uuid

import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

os.environ.setdefault("DATABASE_URL", os.environ.get("TEST_DATABASE_URL", "postgresql+asyncpg://whatsodo:whatsodo@localhost:5432/whatsodo_test"))
os.environ.setdefault("REDIS_URL", os.environ.get("TEST_REDIS_URL", "redis://localhost:6379/1"))
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key")

from app.api.deps import get_current_user  # noqa: E402
from app.core.db import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User  # noqa: E402

TEST_DATABASE_URL = os.environ["DATABASE_URL"]


@pytest.fixture(scope="session", autouse=True)
def apply_migrations():
    """Runs the real Alembic migration chain (including RLS policies)
    against the test database once per test session, so integration tests
    exercise the same schema as production — not an ORM-generated shortcut.
    """
    alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    alembic_cfg.set_main_option("sqlalchemy.url", TEST_DATABASE_URL)
    command.upgrade(alembic_cfg, "head")
    yield
    command.downgrade(alembic_cfg, "base")


@pytest_asyncio.fixture
async def db_session():
    """Transactional test fixture: each test runs inside a transaction that
    is rolled back afterward, so tests never leak state into one another.
    """
    engine = create_async_engine(TEST_DATABASE_URL)
    connection = await engine.connect()
    transaction = await connection.begin()

    session_factory = async_sessionmaker(bind=connection, expire_on_commit=False, class_=AsyncSession, join_transaction_mode="create_savepoint")
    session = session_factory()

    try:
        yield session
    finally:
        await session.close()
        await transaction.rollback()
        await connection.close()
        await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session):
    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def make_user(db_session):
    from app.core.security import hash_password

    async def _make(email: str | None = None, password: str = "correct-horse-battery", full_name: str = "Test User"):
        user = User(
            email=email or f"{uuid.uuid4()}@example.com",
            password_hash=hash_password(password),
            full_name=full_name,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user, password

    return _make


@pytest_asyncio.fixture
async def authed_client(client, make_user, db_session):
    """A client whose requests are already authenticated as a fresh user,
    via the get_current_user dependency override (bypasses the cookie/JWT
    roundtrip for tests that don't specifically exercise auth itself).
    """
    from app.core.db import set_actor_context

    user, _ = await make_user()

    async def _override_get_current_user():
        await db_session.refresh(user)
        # Real get_current_user arms RLS via set_actor_context; the override
        # skips the JWT roundtrip but must still arm it, or every RLS-backed
        # query in the test would see zero rows.
        await set_actor_context(db_session, user.id, user.email)
        return user

    app.dependency_overrides[get_current_user] = _override_get_current_user
    yield client, user
    app.dependency_overrides.pop(get_current_user, None)
