from fastapi.testclient import TestClient
from sqlmodel import Session, select

from backend.database import get_session, init_db
from backend.db.models import Assignment
from backend.main import app


client = TestClient(app)


def test_init_db_clears_old_demo_assignments() -> None:
    init_db()

    with get_session() as session:
        session.add_all(
            [
                Assignment(teacher_id=1, subject_id=1, title="Demo assignment", description="old"),
                Assignment(teacher_id=1, subject_id=1, title="Another demo", description="old"),
            ]
        )
        session.commit()

    init_db()

    with get_session() as session:
        rows = session.exec(select(Assignment)).all()
    assert rows == []


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


def test_list_submissions_for_assignment_returns_created_records() -> None:
    init_db()

    assignment_response = client.post(
        "/assignments",
        json={
            "teacher_id": 1,
            "subject_id": 1,
            "title": "Submission list assignment",
            "description": "Example description",
        },
    )
    assignment_id = assignment_response.json()["id"]

    file_content = b"Sample student answer"
    upload_response = client.post(
        f"/assignments/{assignment_id}/submissions",
        files={"file": ("answer.txt", file_content, "text/plain")},
        data={"student_name": "Student One"},
    )

    assert upload_response.status_code == 201
    list_response = client.get(f"/assignments/{assignment_id}/submissions")
    assert list_response.status_code == 200
    payload = list_response.json()
    assert len(payload) >= 1
    assert payload[0]["student_name"] == "Student One"
