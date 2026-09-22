import httpx
import pytest
from fastapi.testclient import TestClient

from app.core import auth
from app.core.config import Settings
from app.main import app

OWNER = "10000000-0000-4000-8000-000000000001"
OTHER = "10000000-0000-4000-8000-000000000002"
PROFILE = {"id": OWNER, "display_name": "Synthetic Owner", "role": "owner"}


@pytest.fixture
def gateway(monkeypatch):
    monkeypatch.setattr(
        auth,
        "get_settings",
        lambda: Settings(
            _env_file=None,
            supabase_url="https://synthetic.example.test",
            supabase_publishable_key="sb_publishable_synthetic_test_only",
        ),
    )
    state = {
        "identity_status": 200,
        "identity": {"id": OWNER},
        "profile_status": 200,
        "profiles": [PROFILE],
        "requests": [],
        "offline": False,
    }

    def handle(request):
        state["requests"].append(request)
        if state["offline"]:
            raise httpx.ConnectError("synthetic offline", request=request)
        assert request.headers["authorization"] == "Bearer synthetic-token"
        assert request.headers["apikey"] == "sb_publishable_synthetic_test_only"
        if request.url.path == "/auth/v1/user":
            return httpx.Response(state["identity_status"], json=state["identity"])
        assert request.url.path == "/rest/v1/profiles"
        assert request.url.params["id"] == f"eq.{OWNER}"
        return httpx.Response(state["profile_status"], json=state["profiles"])

    async def client():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as transport:
            yield transport

    app.dependency_overrides[auth.auth_client] = client
    yield state
    app.dependency_overrides.clear()


def request_owner():
    return TestClient(app).get("/api/v1/me", headers={"Authorization": "Bearer synthetic-token"})


def test_anonymous_is_denied_before_external_calls(gateway):
    response = TestClient(app).get("/api/v1/me")
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert gateway["requests"] == []


def test_verified_owner_allowed_without_returning_token(gateway):
    response = request_owner()
    assert response.status_code == 200
    assert response.json() == PROFILE
    assert response.headers["cache-control"] == "private, no-store"
    assert len(gateway["requests"]) == 2


@pytest.mark.parametrize("status", [401, 403])
def test_invalid_or_expired_token_is_denied(gateway, status):
    gateway["identity_status"] = status
    assert request_owner().status_code == 401
    assert len(gateway["requests"]) == 1


@pytest.mark.parametrize(
    "profiles",
    [
        [],
        [{**PROFILE, "role": "operator"}],
        [{**PROFILE, "role": "developer"}],
        [{**PROFILE, "id": OTHER}],
    ],
)
def test_only_explicit_matching_owner_allowed(gateway, profiles):
    gateway["profiles"] = profiles
    gateway["identity"] = {"id": OWNER, "user_metadata": {"role": "owner"}}
    assert request_owner().status_code == 403


def test_provider_outage_fails_closed(gateway):
    gateway["offline"] = True
    response = request_owner()
    assert response.status_code == 503
    assert "synthetic-token" not in response.text
    assert response.json()["error"]["code"] == "AUTH_UNAVAILABLE"


@pytest.mark.parametrize(
    "field,value",
    [
        ("identity_status", 500),
        ("identity", {}),
        ("profile_status", 500),
        ("profiles", {"error": "unexpected"}),
    ],
)
def test_provider_errors_do_not_become_access(gateway, field, value):
    gateway[field] = value
    assert request_owner().status_code == 503


def test_unknown_auth_scheme_is_denied(gateway):
    response = TestClient(app).get("/api/v1/me", headers={"Authorization": "Basic synthetic"})
    assert response.status_code == 401
    assert gateway["requests"] == []
