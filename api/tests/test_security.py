import logging
import re
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.security import PrivateRequestMiddleware
from app.core.security_config import SecuritySettings


@pytest.mark.parametrize(
    "origin",
    [
        "*",
        "https://*.example.test",
        "null",
        "https://user:pass@example.test",
        "https://example.test/path",
        "https://example.test?secret=x",
        "http://example.test",
        "https://example.test/#x",
    ],
)
def test_cors_rejects_unsafe_configuration(origin):
    with pytest.raises(ValidationError):
        SecuritySettings(cors_origins=[origin])


def test_cors_exact_origin_and_preflight():
    settings = SecuritySettings(cors_origins=["https://app.example.test"])
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET"],
        allow_headers=["Authorization"],
    )
    client = TestClient(app)
    for origin, expected in [
        ("https://app.example.test", 200),
        ("https://app.example.test.evil.test", 400),
    ]:
        result = client.options(
            "/",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Authorization",
            },
        )
        assert result.status_code == expected
        assert result.headers.get("access-control-allow-origin") == (
            origin if expected == 200 else None
        )
        assert "access-control-allow-credentials" not in result.headers


def test_logging_never_emits_private_input_or_exception(caplog):
    app = FastAPI()
    app.add_middleware(PrivateRequestMiddleware)

    @app.get("/records/{record_id}")
    def fail(record_id: str):
        raise RuntimeError("synthetic-private-exception")

    with caplog.at_level(logging.INFO, logger="isna.requests"):
        response = TestClient(app).get(
            "/records/synthetic-private-id?q=synthetic-private-query",
            headers={
                "Authorization": "Bearer synthetic-private-token",
                "X-Request-ID": "synthetic-private-id",
            },
        )
    assert response.status_code == 500
    assert UUID(response.headers["x-request-id"])
    assert response.headers["cache-control"] == "private, no-store"
    assert "synthetic-private" not in response.text + caplog.text
    assert "route=/records/{record_id}" in caplog.text
    assert "status=500" in caplog.text


def test_unmatched_raw_path_is_not_logged(caplog):
    app = FastAPI()
    app.add_middleware(PrivateRequestMiddleware)
    with caplog.at_level(logging.INFO, logger="isna.requests"):
        result = TestClient(app).get("/synthetic-private-missing")
    assert result.status_code == 404
    assert "synthetic-private" not in caplog.text
    assert "route=unmatched" in caplog.text


def test_every_domain_route_requires_authentication():
    from app.main import app

    client = TestClient(app)
    checked = 0
    for template, operations in app.openapi()["paths"].items():
        if not template.startswith("/api/v1/") or template == "/api/v1/health":
            continue
        path = re.sub(r"\{[^}]+\}", "90000000-0000-4000-8000-000000000001", template)
        for method in operations:
            if method not in {"get", "post", "put", "patch", "delete"}:
                continue
            response = client.request(method, path)
            assert response.status_code == 401, (method, path, response.status_code)
            checked += 1
    assert checked >= 25


def test_anonymous_ai_writes_remain_unavailable():
    from app.main import app

    client = TestClient(app)
    for path in ("/api/v1/ai/uploads", "/api/v1/ai/extract-order"):
        assert client.post(path).status_code == 401


def test_default_cors_does_not_enable_cross_origin_access(monkeypatch):
    monkeypatch.delenv("API_CORS_ORIGINS", raising=False)
    assert SecuritySettings().cors_origins == []
    assert SecuritySettings(cors_origins=["http://localhost:3000"]).cors_origins
