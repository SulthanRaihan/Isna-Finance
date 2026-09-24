import json
from uuid import UUID

import httpx
import pytest
from fastapi.testclient import TestClient

from app.api.master_data import repository
from app.core.auth import require_owner
from app.main import app
from app.repositories.master_data import MasterData
from app.schemas.profile import OwnerProfile

OWNER = "10000000-0000-4000-8000-000000000001"
ACCOUNT = "10000000-0000-4000-8000-000000000002"


@pytest.fixture
def store(monkeypatch):
    import app.repositories.master_data as module
    from app.core.config import Settings

    monkeypatch.setattr(
        module,
        "get_settings",
        lambda: Settings(
            _env_file=None,
            supabase_url="https://synthetic.example.test",
            supabase_publishable_key="sb_publishable_synthetic",
        ),
    )
    state = {"status": 200, "body": [], "requests": [], "timezone": "Asia/Jakarta"}

    def handle(request):
        state["requests"].append(request)
        assert request.headers["authorization"] == "Bearer synthetic-token"
        if request.url.path.endswith("/rpc/business_context"):
            return httpx.Response(
                200, json={"timezone": state["timezone"], "business_date": "2026-09-23"}
            )
        return httpx.Response(state["status"], json=state["body"])

    async def repo():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            yield MasterData(client, "synthetic-token")

    app.dependency_overrides[repository] = repo
    app.dependency_overrides[require_owner] = lambda: OwnerProfile(
        id=UUID(OWNER), display_name="Synthetic", role="owner"
    )
    yield state
    app.dependency_overrides.clear()


@pytest.mark.parametrize(
    "path", ["customers", "accounts", "teams", "daily-accounts?date=2026-09-23", "business-context"]
)
def test_master_routes_deny_anonymous(path):
    assert TestClient(app).get(f"/api/v1/{path}").status_code == 401


def test_customer_create_trims_and_forbids_extra_fields(store):
    store["body"] = [{"id": OWNER, "display_name": "Synthetic"}]
    client = TestClient(app)
    response = client.post("/api/v1/customers", json={"display_name": " Synthetic "})
    assert response.status_code == 201
    assert json.loads(store["requests"][-1].content)["display_name"] == "Synthetic"
    assert (
        client.post(
            "/api/v1/customers", json={"display_name": "X", "created_by": OWNER}
        ).status_code
        == 422
    )


def test_account_rejects_full_number_and_invalid_last4(store):
    client = TestClient(app)
    base = {"label": "Synthetic", "bank_name": "Demo", "country_code": "ID"}
    assert (
        client.post("/api/v1/accounts", json={**base, "account_last4": "123456789"}).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/accounts", json={**base, "protected_account_number": "123456789"}
        ).status_code
        == 422
    )
    assert store["requests"] == []


@pytest.mark.parametrize("rate", [1.7, "-1", "NaN", "1.1234567"])
def test_invalid_rate_is_rejected(store, rate):
    assert (
        TestClient(app)
        .post("/api/v1/teams", json={"name": "Synthetic", "default_fee_rate": rate})
        .status_code
        == 422
    )


def test_valid_decimal_preserves_precision(store):
    store["body"] = [{"id": OWNER, "name": "Synthetic", "default_fee_rate": "1.700001"}]
    response = TestClient(app).post(
        "/api/v1/teams", json={"name": "Synthetic", "default_fee_rate": "1.700001"}
    )
    assert response.status_code == 201
    assert json.loads(store["requests"][-1].content)["default_fee_rate"] == "1.700001"
    assert response.json()["default_fee_rate"] == "1.700001"


def test_deactivation_returns_conflicts_without_followup_writes(store):
    conflicts = [{"business_date": "2026-09-23", "account_id": ACCOUNT, "is_default": True}]
    store.update(
        status=400,
        body={"code": "P0001", "message": "ACCOUNT_ASSIGNED", "details": json.dumps(conflicts)},
    )
    response = TestClient(app).patch(f"/api/v1/accounts/{ACCOUNT}", json={"is_active": False})
    assert response.status_code == 409
    assert response.json()["error"]["fields"]["conflicting_assignments"] == conflicts
    assert [request.method for request in store["requests"]] == ["POST", "PATCH"]


def test_invalid_default_does_not_call_database(store):
    response = TestClient(app).put(
        "/api/v1/daily-accounts/2026-09-23",
        json={"active_account_ids": [], "default_account_id": ACCOUNT},
    )
    assert response.status_code == 422
    assert store["requests"] == []


def test_daily_write_is_one_atomic_rpc(store):
    response = TestClient(app).put(
        "/api/v1/daily-accounts/2026-09-23",
        json={"active_account_ids": [ACCOUNT], "default_account_id": ACCOUNT},
    )
    assert response.status_code == 200
    request = store["requests"][-1]
    assert request.url.path.endswith("/rpc/replace_daily_accounts")
    assert json.loads(request.content) == {
        "p_date": "2026-09-23",
        "p_account_ids": [ACCOUNT],
        "p_default": ACCOUNT,
    }


def test_inactive_account_database_rejection(store):
    store.update(status=400, body={"code": "22023", "message": "Account must exist and be active"})
    response = TestClient(app).put(
        "/api/v1/daily-accounts/2026-09-23",
        json={"active_account_ids": [ACCOUNT], "default_account_id": None},
    )
    assert response.status_code == 422


def test_timezone_mismatch_stops_mutation(store):
    store["timezone"] = "Asia/Shanghai"
    response = TestClient(app).patch(f"/api/v1/accounts/{ACCOUNT}", json={"is_active": False})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "TIMEZONE_MISMATCH"
    assert len(store["requests"]) == 1


def test_list_pagination_and_literal_search(store):
    response = TestClient(app).get(
        "/api/v1/customers", params={"q": "A%_", "active": "true", "offset": 20, "limit": 20}
    )
    assert response.status_code == 200
    params = store["requests"][-1].url.params
    assert params["is_active"] == "eq.true"
    assert params["offset"] == "20"
    assert params["display_name"] == r"ilike.%A\%\_%"
