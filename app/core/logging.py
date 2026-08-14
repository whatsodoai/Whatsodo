import logging
import sys
from contextvars import ContextVar

import structlog

request_id_ctx: ContextVar[str] = ContextVar("request_id", default="")
user_id_ctx: ContextVar[str] = ContextVar("user_id", default="")
workspace_id_ctx: ContextVar[str] = ContextVar("workspace_id", default="")


def _bind_context_vars(logger, method_name, event_dict):
    if rid := request_id_ctx.get():
        event_dict["request_id"] = rid
    if uid := user_id_ctx.get():
        event_dict["user_id"] = uid
    if wid := workspace_id_ctx.get():
        event_dict["workspace_id"] = wid
    return event_dict


def configure_logging(log_level: str) -> None:
    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=log_level)

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            _bind_context_vars,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.getLevelName(log_level)),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str = "whatsodo"):
    return structlog.get_logger(name)
