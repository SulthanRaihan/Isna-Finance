import json

import pytest
from fastapi.testclient import TestClient
from test_master_data import store as master_store

from app.main import app

store = master_store


@pytest.mark.parametrize("path", ["dashboard/daily", "recaps/daily"])
def test_reports_require_owner(path):
    assert TestClient(app).get(f"/api/v1/{path}?date=2020-01-02").status_code == 401


def test_report_uses_exact_backend_snapshot(store):
    store["body"] = {
        "customer_count": 1,
        "order_count": 2,
        "money_in_idr": "999999999999999999.99",
        "business_position": {"status": "not_configured", "amount_idr": None},
    }
    response = TestClient(app).get(
        "/api/v1/recaps/daily?date=2020-01-02&section=pending&limit=1&offset=2"
    )
    assert response.status_code == 200
    assert response.json() == store["body"]
    assert response.headers["cache-control"] == "private, no-store"
    assert json.loads(store["requests"][-1].content) == {
        "p_date": "2020-01-02",
        "p_section": "pending",
        "p_limit": 1,
        "p_offset": 2,
    }


@pytest.mark.parametrize(
    "query",
    [
        "date=bad",
        "date=2020-01-01&limit=101",
        "date=2020-01-01&offset=-1",
        "date=2020-01-01&section=unknown",
        "",
    ],
)
def test_report_validation(store, query):
    assert TestClient(app).get(f"/api/v1/recaps/daily?{query}").status_code == 422


def test_report_timezone_mismatch_fails_closed(store):
    store["timezone"] = "UTC"
    assert TestClient(app).get("/api/v1/dashboard/daily?date=2020-01-01").status_code == 503
    assert not any(r.url.path.endswith("/rpc/daily_report") for r in store["requests"])
