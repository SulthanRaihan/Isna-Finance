import json
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from test_master_data import store as master_store

from app.main import app
from app.repositories.master_data import DataError
from app.schemas.orders import OrderCreate, OrderPatch, ReceivePayment
from app.services.orders import expected_idr, present_order

store = master_store

ID = "10000000-0000-4000-8000-000000000002"
BODY = {
    "customer_id": ID,
    "business_date": "2026-09-25",
    "cny_amount": "1.00",
    "customer_rate": "100.005000",
    "receiving_account_id": ID,
    "note": None,
}
ROW = {
    **BODY,
    "id": ID,
    "expected_idr": "100.01",
    "payment_status": "awaiting",
    "fulfillment_status": "pending",
    "idr_received_at": None,
    "cny_sent_at": None,
    "updated_at": "2026-09-25T00:00:00+00:00",
}


@pytest.mark.parametrize(
    "amount,rate,result",
    [
        ("10000", "2647", "26470000.00"),
        ("1", "100.005", "100.01"),
        ("1", "100.004999", "100.00"),
        ("0.01", "0.5", "0.01"),
        ("9999999999999999.99", "1", "9999999999999999.99"),
    ],
)
def test_half_up_exact(amount, rate, result):
    assert str(expected_idr(Decimal(amount), Decimal(rate))) == result


def test_overflow():
    with pytest.raises(DataError):
        expected_idr(Decimal("9999999999999999.99"), Decimal("999999999999.999999"))


@pytest.mark.parametrize(
    "field,value",
    [
        ("cny_amount", 1.2),
        ("customer_rate", 100),
        ("cny_amount", "NaN"),
        ("cny_amount", "0"),
        ("customer_rate", "-1"),
        ("cny_amount", "1.001"),
        ("customer_rate", "1.0000001"),
        ("expected_idr", "999"),
        ("created_by", ID),
    ],
)
def test_strict_create(field, value):
    with pytest.raises(ValidationError):
        OrderCreate.model_validate({**BODY, field: value})


@pytest.mark.parametrize("payload", [{}, {"cny_amount": None}, {"payment_status": "received"}])
def test_invalid_patch(payload):
    with pytest.raises(ValidationError):
        OrderPatch.model_validate(payload)


def test_naive_timestamp_denied():
    with pytest.raises(ValidationError):
        ReceivePayment(received_at="2026-09-25T12:00:00")


def test_received_date_not_order_date():
    row = present_order(
        {
            **ROW,
            "business_date": "2026-09-20",
            "payment_status": "received",
            "idr_received_at": "2026-09-25T18:00:00Z",
        }
    )
    assert row["money_in_date"] == "2026-09-26"
    assert row["ui_status"] == "ready_to_send"
    waiting = present_order({**ROW, "fulfillment_status": "sent"})
    assert waiting["money_in_date"] is None
    assert waiting["warnings"]
    assert waiting["ui_status"] == "sent_awaiting_payment"


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/orders"),
        ("post", "/orders"),
        ("get", f"/orders/{ID}"),
        ("patch", f"/orders/{ID}"),
        ("post", f"/orders/{ID}/receive-payment"),
        ("post", f"/orders/{ID}/mark-sent"),
        ("get", f"/audit/orders/{ID}"),
    ],
)
def test_anonymous_denied(method, path):
    assert getattr(TestClient(app), method)("/api/v1" + path).status_code == 401


def test_create_recalculates_and_requires_key(store):
    store["body"] = ROW
    client = TestClient(app)
    assert client.post("/api/v1/orders", json=BODY).status_code == 422
    response = client.post("/api/v1/orders", json=BODY, headers={"Idempotency-Key": "synthetic-1"})
    assert response.status_code == 201
    sent = json.loads(store["requests"][-1].content)
    assert sent["p_payload"]["expected_idr"] == "100.01"
    assert sent["p_payload"]["customer_rate"] == "100.005000"
    assert sent["p_key"] == "synthetic-1"
    assert response.json()["expected_idr"] == "100.01"


@pytest.mark.parametrize(
    "code,status",
    [
        ("ORDER_LOCKED", 409),
        ("STATE_CONFLICT", 409),
        ("STALE_ORDER", 409),
        ("IDEMPOTENCY_CONFLICT", 409),
        ("ACCOUNT_NOT_ASSIGNED", 422),
    ],
)
def test_rpc_errors_are_actionable(store, code, status):
    store.update(status=400, body={"code": "P0001", "message": code})
    response = TestClient(app).post(
        "/api/v1/orders", json=BODY, headers={"Idempotency-Key": "synthetic"}
    )
    assert response.status_code == status
    assert response.json()["error"]["code"] == code


def test_order_filters_and_decimal_output(store):
    store["body"] = [ROW]
    response = TestClient(app).get(
        "/api/v1/orders", params={"q": "A%_", "date_from": "2026-09-01", "date_to": "2026-09-30"}
    )
    assert response.status_code == 200
    query = store["requests"][-1].url.params
    assert query["customer.display_name"] == r"ilike.%A\%\_%"
    assert query["and"] == "(business_date.gte.2026-09-01,business_date.lte.2026-09-30)"
    assert isinstance(response.json()["items"][0]["expected_idr"], str)
