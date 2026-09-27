"""Allowlisted request telemetry; never serialize request data or exceptions."""

import logging
from time import monotonic
from uuid import uuid4

from starlette.responses import JSONResponse

logger = logging.getLogger("isna.requests")


def configure_private_logging():
    logger.setLevel(logging.INFO)
    if not logger.handlers:
        logger.addHandler(logging.StreamHandler())
    # These libraries otherwise include full URLs or raw exception content.
    for name in ("uvicorn.access", "httpx", "httpcore"):
        target = logging.getLogger(name)
        target.disabled = True
        target.setLevel(logging.CRITICAL + 1)
        target.addFilter(lambda record: False)


class PrivateRequestMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        request_id = str(uuid4())
        started = monotonic()
        status = 500
        sent = False

        async def safe_send(message):
            nonlocal status, sent
            if message["type"] == "http.response.start":
                status, sent = message["status"], True
                headers = [
                    (key, value)
                    for key, value in message.get("headers", [])
                    if key.lower()
                    not in {b"cache-control", b"x-request-id", b"x-content-type-options"}
                ]
                headers.extend(
                    [
                        (b"x-request-id", request_id.encode()),
                        (b"cache-control", b"private, no-store"),
                        (b"x-content-type-options", b"nosniff"),
                    ]
                )
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, safe_send)
        except Exception:
            # No traceback: it may contain financial payloads/provider credentials.
            if not sent:
                response = JSONResponse(
                    {
                        "error": {
                            "code": "INTERNAL_ERROR",
                            "message": "Request could not be completed.",
                            "fields": {},
                        }
                    },
                    status_code=500,
                )
                await response(scope, receive, safe_send)
        finally:
            route = getattr(scope.get("route"), "path", "unmatched")
            method = scope.get("method")
            if method not in {"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"}:
                method = "OTHER"
            logger.info(
                "request id=%s method=%s route=%s status=%s duration_ms=%s",
                request_id,
                method,
                route,
                status,
                round((monotonic() - started) * 1000),
            )
