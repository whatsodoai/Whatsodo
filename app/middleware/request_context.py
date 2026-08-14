import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.logging import get_logger, request_id_ctx, user_id_ctx, workspace_id_ctx

logger = get_logger("access")


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Generates/propagates a request_id and logs method/path/status/duration
    for every request. user_id/workspace_id are bound later by the auth/
    tenant dependencies once resolved, and included automatically if set.
    """

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-Id", str(uuid.uuid4()))
        request_id_ctx.set(request_id)
        user_id_ctx.set("")
        workspace_id_ctx.set("")

        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)

        response.headers["X-Request-Id"] = request_id
        logger.info(
            "http.request",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
        )
        return response
