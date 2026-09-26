from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_is_public_and_returns_only_liveness():
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert response.json() == {"status": "ok"}


def test_future_financial_routes_are_not_exposed():
    assert client.get("/api/v1/dashboard/daily?date=2020-01-01").status_code == 404


def test_health_does_not_allow_writes():
    assert client.post("/api/v1/health").status_code == 405
