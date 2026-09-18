from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from backend.constants import ALLOWED_UPLOAD_EXTENSIONS, MAX_UPLOAD_SIZE_BYTES, UPLOAD_DIR
from backend.database import get_session
from backend.db.models import Assignment, Submission

router = APIRouter(tags=["submissions"])

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _validate_upload_file(file: UploadFile) -> None:
    """Validate file extension and size before saving to disk."""
    if file.filename is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File name is required")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type. Allowed: pdf, docx, txt, jpg, jpeg, png")

    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    if file_size > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File size exceeds 10MB limit")


@router.post("/assignments/{assignment_id}/submissions", response_model=dict[str, Any], status_code=status.HTTP_201_CREATED)
def create_submission(
    assignment_id: int,
    file: UploadFile = File(...),
    student_name: str = Form(...),
) -> dict[str, Any]:
    """Save a valid student submission file and record its metadata in the database."""
    with get_session() as session:
        assignment = session.get(Assignment, assignment_id)
        if assignment is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

        _validate_upload_file(file)

        safe_name = Path(file.filename).name
        target_path = UPLOAD_DIR / f"{assignment_id}_{safe_name}"
        content = file.file.read()
        target_path.write_bytes(content)

        submission = Submission(
            assignment_id=assignment_id,
            student_name=student_name,
            file_path=str(target_path),
            status="uploaded",
        )
        session.add(submission)
        session.commit()
        session.refresh(submission)

        return {
            "id": submission.id,
            "assignment_id": assignment_id,
            "student_name": submission.student_name,
            "file_name": safe_name,
            "file_path": submission.file_path,
            "status": submission.status,
            "created_at": submission.created_at,
            "updated_at": submission.updated_at,
        }


@router.get("/submissions/{submission_id}", response_model=dict[str, Any], status_code=status.HTTP_200_OK)
def get_submission(submission_id: int) -> dict[str, Any]:
    """Return a single submission record."""
    with get_session() as session:
        submission = session.get(Submission, submission_id)
        if submission is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

        return {
            "id": submission.id,
            "assignment_id": submission.assignment_id,
            "student_name": submission.student_name,
            "file_path": submission.file_path,
            "status": submission.status,
            "created_at": submission.created_at,
            "updated_at": submission.updated_at,
        }
