import json
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from test_master_data import store as master_store

from app.main import app
from app.schemas.team_activity import ActivityCreate, MovementCreate
from app.services.orders import expected_idr

store = master_store
ID = "20000000-0000-4000-8000-000000000001"
BODY = {
    "team_id": ID,
    "business_date": "2020-01-01",
    "actual_cny_handled": "1",
    "fee_rate": "100.005",
}


@pytest.mark.parametrize(
    "amount,rate,result",
    [
        ("16000", "2", "32000.00"),
        ("5600", "1.7", "9520.00"),
        ("1", "100.005", "100.01"),
        ("1", "0", "0.00"),
    ],
)
def test_fee_math(amount, rate, result):
    assert str(expected_idr(Decimal(amount), Decimal(rate))) == result


def test_create_calculates_and_cannot_post_from_client(store):
    store["body"] = {"activity": {"fee_status": "unpaid"}, "outflow": None}
    client = TestClient(app)
    response = client.post(
        "/api/v1/team-activities", json=BODY, headers={"Idempotency-Key": "create"}
    )
    assert response.status_code == 201
    payload = json.loads(store["requests"][-1].content)
    assert payload["p_payload"]["calculated_fee_idr"] == "100.01"
    assert payload["p_payload"]["fee_rate"] == "100.005000"
    assert response.json()["outflow"] is None
    assert (
        client.post(
            "/api/v1/team-activities",
            json={**BODY, "fee_status": "paid"},
            headers={"Idempotency-Key": "bad"},
        ).status_code
        == 422
    )


@pytest.mark.parametrize(
    "field,value",
    [
        ("fee_rate", -1),
        ("fee_rate", "NaN"),
        ("fee_rate", "-1"),
        ("actual_cny_handled", "1.001"),
        ("actual_cny_handled", "0"),
    ],
)
def test_reject_invalid_activity(field, value):
    with pytest.raises(ValidationError):
        ActivityCreate.model_validate({**BODY, field: value})


def test_signed_adjustment():
    base = {"team_id": ID, "business_date": "2020-01-01", "cny_amount": "-2.50"}
    assert MovementCreate.model_validate(
        {**base, "movement_type": "adjustment"}
    ).cny_amount == Decimal("-2.50")
    with pytest.raises(ValidationError):
        MovementCreate.model_validate({**base, "movement_type": "distributed"})


def test_payment_passes_actual_date_only(store):
    store["body"] = {}
    response = TestClient(app).post(
        f"/api/v1/team-activities/{ID}/pay",
        json={"payment_date": "2020-01-03", "updated_at": "2020-01-01T00:00:00Z"},
        headers={"Idempotency-Key": "pay"},
    )
    assert response.status_code == 200
    assert json.loads(store["requests"][-1].content)["p_payload"]["payment_date"] == "2020-01-03"


@pytest.mark.parametrize(
    "path",
    [
        f"/team-activities?team_id={ID}",
        f"/teams/{ID}/ledger?date=2020-01-01",
        f"/team-movements?order_id={ID}",
    ],
)
def test_owner_required(path):
    assert TestClient(app).get("/api/v1" + path).status_code == 401
