from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def test_chat_returns_response() -> None:
    response = client.post(
        "/chat",
        json={
            "message": "Talaba javobi haqida umumiy fikr bering.",
            "context": "Fan: Python; topshiriq: loops",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert "reply" in body
    assert isinstance(body["reply"], str)
    assert len(body["reply"]) > 0
