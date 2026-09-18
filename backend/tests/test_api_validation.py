from fastapi.testclient import TestClient

from backend.database import init_db
from backend.main import app


client = TestClient(app)


def test_create_assignment_requires_required_fields() -> None:
    init_db()
    response = client.post("/assignments", json={"teacher_id": 1})
    assert response.status_code == 422


def test_create_assignment_accepts_valid_payload() -> None:
    init_db()
    response = client.post(
        "/assignments",
        json={
            "teacher_id": 1,
            "subject_id": 1,
            "title": "Sample assignment",
            "description": "Example description",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Sample assignment"
