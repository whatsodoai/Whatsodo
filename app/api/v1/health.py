from fastapi import APIRouter, Response, status
from redis.asyncio import from_url
from sqlalchemy import text

from app.core.config import get_settings
from app.core.db import engine
from app.schemas.health import HealthOut, ReadinessOut

router = APIRouter(tags=["health"])
settings = get_settings()


@router.get("/health", response_model=HealthOut)
async def health() -> HealthOut:
    return HealthOut(status="ok", version=settings.version, environment=settings.environment)


@router.get("/health/ready", response_model=ReadinessOut)
async def readiness(response: Response) -> ReadinessOut:
    db_status = "ok"
    redis_status = "ok"

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"

    try:
        redis_client = from_url(settings.redis_url)
        await redis_client.ping()
        await redis_client.aclose()
    except Exception:
        redis_status = "error"

    if db_status != "ok" or redis_status != "ok":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return ReadinessOut(
        status="ok" if db_status == "ok" and redis_status == "ok" else "error",
        database=db_status,
        redis=redis_status,
    )
