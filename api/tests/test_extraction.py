import asyncio
import json
from io import BytesIO
from uuid import UUID

import httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import ValidationError

from app.api import extraction
from app.core.ai_config import AISettings
from app.core.auth import require_owner
from app.main import app
from app.repositories.master_data import DataError
from app.schemas.extraction import RawExtraction, UploadTicket
from app.services.ai.drafts import make_draft
from app.services.ai.images import validate_image
from app.services.ai.provider import OpenAIProvider

JOB = "80000000-0000-4000-8000-000000000001"
RAW = {
    "multiple_orders": False,
    "customer_text": "Synthetic Customer",
    "cny_amount": "100.25",
    "customer_rate": "2300.005",
    "confidence": {"customer": 0.8, "cny_amount": 0.9, "customer_rate": 0.7},
}


def picture(format="PNG", size=(20, 20)):
    output = BytesIO()
    Image.new("RGB", size, "white").save(output, format=format)
    return output.getvalue()


@pytest.mark.parametrize("mime,format", [("image/png", "PNG"), ("image/jpeg", "JPEG")])
def test_valid_images(mime, format):
    validate_image(picture(format), mime)


@pytest.mark.parametrize(
    "data,mime",
    [
        (b"bad", "image/png"),
        (picture(), "image/jpeg"),
        (b"x" * 5_000_001, "image/png"),
        (b"", "image/png"),
    ],
    ids=["corrupt", "mime_mismatch", "oversized", "empty"],
)
def test_invalid_images(data, mime):
    with pytest.raises(DataError):
        validate_image(data, mime)


def test_pixel_limit_and_animation():
    with pytest.raises(DataError):
        validate_image(picture(size=(5001, 4000)), "image/png")
    output = BytesIO()
    Image.new("RGB", (2, 2), "white").save(
        output, format="PNG", save_all=True, append_images=[Image.new("RGB", (2, 2), "black")]
    )
    with pytest.raises(DataError):
        validate_image(output.getvalue(), "image/png")


@pytest.mark.parametrize(
    "field,value",
    [
        ("mime_type", "image/webp"),
        ("size_bytes", 5_000_001),
        ("size_bytes", 0),
        ("size_bytes", "100"),
    ],
)
def test_ticket_limits(field, value):
    body = {"mime_type": "image/png", "size_bytes": 50, field: value}
    with pytest.raises(ValidationError):
        UploadTicket.model_validate(body)


@pytest.mark.parametrize("amount", ["-1", "0", "NaN", "1.001", "1,000", ""])
def test_invalid_extracted_amount_requires_manual_entry(amount):
    result = make_draft(RawExtraction.model_validate({**RAW, "cny_amount": amount}), [])
    assert result["draft"]["cny_amount"] is None
    assert "REVIEW_CNY_AMOUNT" in result["warnings"]


def test_multiple_orders_never_selects_one():
    result = make_draft(RawExtraction.model_validate({**RAW, "multiple_orders": True}), [])
    assert all(v is None for v in result["draft"].values())
    assert result["warnings"] == ["MULTIPLE_ORDERS"]


def test_customer_matching_is_local_and_ambiguity_requires_choice():
    raw = RawExtraction.model_validate(RAW)
    candidate = {"id": JOB, "display_name": " synthetic customer ", "is_active": True}
    assert make_draft(raw, [candidate])["draft"]["matched_customer_id"] == JOB
    assert make_draft(raw, [candidate, candidate])["draft"]["matched_customer_id"] is None
    assert (
        make_draft(raw, [{**candidate, "is_active": False}])["draft"]["matched_customer_id"] is None
    )


@pytest.mark.parametrize("extra", ["expected_idr", "matched_customer_id", "payment_status"])
def test_model_cannot_supply_authoritative_fields(extra):
    with pytest.raises(ValidationError):
        RawExtraction.model_validate({**RAW, extra: "injected"})


def test_responses_adapter_uses_frozen_model_schema_and_no_tools():
    async def run():
        def handle(request):
            payload = json.loads(request.content)
            assert str(request.url) == "https://api.openai.com/v1/responses"
            assert payload["model"] == "gpt-5.4-mini"
            assert payload["store"] is False
            assert "tools" not in payload
            assert payload["text"]["format"]["strict"] is True
            assert len(payload["input"][0]["content"]) == 1
            assert payload["input"][0]["content"][0]["type"] == "input_image"
            assert "untrusted data" in payload["instructions"]
            assert JOB not in request.content.decode()
            return httpx.Response(
                200,
                json={
                    "status": "completed",
                    "output": [
                        {
                            "type": "message",
                            "content": [{"type": "output_text", "text": json.dumps(RAW)}],
                        }
                    ],
                },
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            result = await OpenAIProvider(
                client, AISettings(_env_file=None, openai_api_key="synthetic-secret")
            ).extract_order(picture(), "image/png")
            assert result.cny_amount == "100.25"

    asyncio.run(run())


@pytest.mark.parametrize(
    "response",
    [
        {"status": "incomplete"},
        {"status": "completed", "output": [{"type": "message", "content": [{"type": "refusal"}]}]},
        {"status": "completed", "output": []},
    ],
)
def test_provider_failures_are_generic(response):
    async def run():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda request: httpx.Response(200, json=response))
        ) as client:
            with pytest.raises(DataError) as error:
                await OpenAIProvider(
                    client, AISettings(_env_file=None, openai_api_key="synthetic-secret")
                ).extract_order(picture(), "image/png")
            assert error.value.code == "AI_UNAVAILABLE"
            assert "synthetic-secret" not in error.value.message

    asyncio.run(run())


@pytest.mark.parametrize("failure", [False, True, "invalid_image", "timeout"])
def test_extraction_cleans_up_success_failure_and_never_posts_finances(monkeypatch, failure):
    image = picture()
    calls = []

    class Repo:
        async def job(self, action, job_id):
            calls.append(action)
            return {
                "id": JOB,
                "object_path": JOB + ".png",
                "mime_type": "image/png",
                "size_bytes": len(image),
            }

        async def download(self, path):
            return image if failure != "invalid_image" else b"bad"

        async def remove(self, path):
            calls.append("remove")

        async def customers(self, text):
            return []

    class Provider:
        def __init__(self, *args):
            pass

        async def extract_order(self, *args):
            if failure == "timeout":
                raise TimeoutError
            if failure is True:
                raise DataError(503, "AI_UNAVAILABLE", "unavailable")
            return RawExtraction.model_validate(RAW)

    monkeypatch.setattr(extraction, "enabled_settings", lambda: AISettings(_env_file=None))
    monkeypatch.setattr(extraction, "OpenAIProvider", Provider)
    app.dependency_overrides[require_owner] = lambda: {"id": JOB, "role": "owner"}
    app.dependency_overrides[extraction.extraction_repository] = lambda: Repo()
    try:
        response = TestClient(app).post("/api/v1/ai/extract-order", json={"job_id": JOB})
        assert response.status_code == (
            422 if failure == "invalid_image" else 503 if failure else 200
        )
        assert calls == ["claim", "remove", "finish"]
        if not failure:
            assert "expected_idr" not in response.text
            assert UUID(response.headers["x-request-id"])
    finally:
        app.dependency_overrides.clear()


def test_normalizes_valid_decimal_notation_without_computing_idr():
    raw = RawExtraction.model_validate({**RAW, "cny_amount": "1e3"})
    result = make_draft(raw, [])
    assert result["draft"]["cny_amount"] == "1000"
    assert "expected_idr" not in result["draft"]


def test_request_accepts_one_job_only():
    from app.schemas.extraction import ExtractRequest

    with pytest.raises(ValidationError):
        ExtractRequest.model_validate({"job_id": JOB, "second_job": JOB})
    with pytest.raises(ValidationError):
        ExtractRequest.model_validate({"job_id": [JOB, JOB]})


def test_disabled_extraction_never_creates_upload(monkeypatch):
    calls = []

    class Repo:
        async def job(self, *args, **kwargs):
            calls.append("unexpected")

    monkeypatch.setattr(extraction, "AISettings", lambda: AISettings(_env_file=None))
    app.dependency_overrides[require_owner] = lambda: {"id": JOB, "role": "owner"}
    app.dependency_overrides[extraction.extraction_repository] = lambda: Repo()
    try:
        result = TestClient(app).post(
            "/api/v1/ai/uploads", json={"mime_type": "image/png", "size_bytes": 10}
        )
        assert result.status_code == 503
        assert calls == []
    finally:
        app.dependency_overrides.clear()
