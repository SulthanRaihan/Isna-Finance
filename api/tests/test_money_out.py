import json
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from test_master_data import store as master_store

from app.main import app
from app.schemas.money_out import AtmCreate, ManualOutflow
from app.services.orders import expected_idr


def test_atm_fee_vector():
    assert expected_idr(Decimal("5600"), Decimal("1.7")) == Decimal("9520.00")


def test_exchange_fee_is_direct_idr():
    row = ManualOutflow.model_validate(
        {
            "business_date": "2020-01-01",
            "category": "exchange_fee",
            "description": "Synthetic fee",
            "amount_idr": "19.25",
        }
    )
    assert row.amount_idr == Decimal("19.25")
    with pytest.raises(ValidationError):
        ManualOutflow.model_validate(
            {
                "business_date": "2020-01-01",
                "category": "exchange_fee",
                "description": "Synthetic fee",
                "cny_amount": "1",
                "rate_or_fee": "19.25",
            }
        )


@pytest.mark.parametrize("category", ["team_fee", "atm_card_fee"])
def test_manual_fee_bypass_denied(category):
    with pytest.raises(ValidationError):
        ManualOutflow.model_validate(
            {
                "business_date": "2020-01-01",
                "category": category,
                "description": "Synthetic",
                "amount_idr": "1",
            }
        )


def test_atm_cannot_set_paid_on_create():
    with pytest.raises(ValidationError):
        AtmCreate.model_validate(
            {
                "business_date": "2020-01-01",
                "actual_cny_handled": "5600",
                "fee_rate": "1.7",
                "fee_status": "paid",
            }
        )


store = master_store
ID = "20000000-0000-4000-8000-000000000001"


@pytest.mark.parametrize("path", ["outflows", "atm-activities", f"outflows/{ID}"])
def test_anonymous_denied(path):
    assert TestClient(app).get(f"/api/v1/{path}").status_code == 401


def test_atm_authoritative_fee(store):
    store["body"] = {"activity": {"fee_status": "unpaid"}, "outflow": None}
    result = TestClient(app).post(
        "/api/v1/atm-activities",
        json={
            "business_date": "2020-01-01",
            "actual_cny_handled": "1",
            "fee_rate": "100.005",
        },
        headers={"Idempotency-Key": "synthetic"},
    )
    assert result.status_code == 201
    assert result.json()["outflow"] is None
    body = json.loads(store["requests"][-1].content)["p_payload"]
    assert body["calculated_fee_idr"] == "100.01"
    assert body["actual_cny_handled"] == "1.00"


@pytest.mark.parametrize("category", ["rmb_purchase", "exchange_fee", "other"])
def test_manual_category_calculation(store, category):
    body = {"category": category, "business_date": "2020-01-01", "description": "Synthetic"}
    body.update(
        {"cny_amount": "1", "rate_or_fee": "100.005"}
        if category == "rmb_purchase"
        else {"amount_idr": "100.01"}
    )
    response = TestClient(app).post(
        "/api/v1/outflows", json=body, headers={"Idempotency-Key": "synthetic"}
    )
    assert response.status_code == 201
    posted = json.loads(store["requests"][-1].content)["p_payload"]
    assert posted["amount_idr"] == "100.01"
    assert ("rate_or_fee" in posted) == (category == "rmb_purchase")


def test_posted_default_and_exact_json_decimal(store):
    store["body"] = [{"amount_idr": Decimal("999999999999999999.99")}]
    # Mock transport JSON expects strings; repository also handles JSON numeric Decimals.
    store["body"][0]["amount_idr"] = "999999999999999999.99"
    response = TestClient(app).get("/api/v1/outflows")
    assert response.json()["items"][0]["amount_idr"] == "999999999999999999.99"
    assert store["requests"][-1].url.params["status"] == "eq.posted"
    TestClient(app).get("/api/v1/outflows?status=all")
    assert "status" not in store["requests"][-1].url.params


@pytest.mark.parametrize("reason", ["", "   ", "x" * 2001])
def test_void_requires_reason(store, reason):
    response = TestClient(app).post(
        f"/api/v1/outflows/{ID}/void",
        json={"reason": reason, "updated_at": "2020-01-01T00:00:00Z"},
        headers={"Idempotency-Key": "synthetic"},
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "category", ["team_fee", "atm_card_fee", "rmb_purchase", "exchange_fee", "other"]
)
def test_correction_uses_original_category(store, category):
    store["body"] = [{"category": category}]
    body = {
        "reason": "Synthetic correction",
        "updated_at": "2020-01-01T00:00:00Z",
        "business_date": "2020-01-02",
        "description": "Synthetic",
    }
    body.update(
        {"cny_amount": "1", "rate_or_fee": "100.005"}
        if category in {"rmb_purchase", "team_fee", "atm_card_fee"}
        else {"amount_idr": "100.01"}
    )
    response = TestClient(app).post(
        f"/api/v1/outflows/{ID}/correct", json=body, headers={"Idempotency-Key": "synthetic"}
    )
    assert response.status_code == 200
    posted = json.loads(store["requests"][-1].content)["p_payload"]
    assert posted["amount_idr"] == "100.01"
    assert "category" not in posted


def test_fee_correction_rejects_direct_idr(store):
    store["body"] = [{"category": "team_fee"}]
    response = TestClient(app).post(
        f"/api/v1/outflows/{ID}/correct",
        json={
            "reason": "Synthetic",
            "updated_at": "2020-01-01T00:00:00Z",
            "business_date": "2020-01-01",
            "description": "Synthetic",
            "amount_idr": "1",
        },
        headers={"Idempotency-Key": "synthetic"},
    )
    assert response.status_code == 422
    assert not any(r.url.path.endswith("/rpc/mutate_money_out") for r in store["requests"])


@pytest.mark.parametrize("value", ["NaN", "Infinity", "-0.01", "1.001", 12.5])
def test_direct_idr_rejects_invalid_values(value):
    with pytest.raises(ValidationError):
        ManualOutflow.model_validate(
            {
                "category": "exchange_fee",
                "business_date": "2020-01-01",
                "description": "Synthetic",
                "amount_idr": value,
            }
        )
