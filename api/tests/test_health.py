from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_is_public_and_returns_only_liveness():
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert response.json() == {"status": "ok"}


def test_no_order_routes_are_exposed():
    assert client.post("/api/v1/orders", json={}).status_code == 404


def test_health_does_not_allow_writes():
    assert client.post("/api/v1/health").status_code == 405
