from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import BaseModel
from sqlmodel import select

from backend.database import get_session
from backend.db.grading_models import GradingResult
from backend.db.models import Submission
from backend.grading_engine.engine import grade_submission, run_grading_job

router = APIRouter(tags=["grading"])


class TeacherApprovalPayload(BaseModel):
    final_score: float
    teacher_note: str = ""


@router.post("/submissions/{submission_id}/grade", response_model=dict[str, Any], status_code=status.HTTP_202_ACCEPTED)
def grade_submission_endpoint(submission_id: int, background_tasks: BackgroundTasks) -> dict[str, Any]:
    """Start async grading for a submission and return an accepted status immediately."""
    with get_session() as session:
        submission = session.get(Submission, submission_id)
        if submission is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    background_tasks.add_task(run_grading_job, submission_id)
    return {
        "submission_id": submission_id,
        "status": "pending",
        "message": "Grading started in the background.",
    }


@router.get("/submissions/{submission_id}/status", response_model=dict[str, Any], status_code=status.HTTP_200_OK)
def get_submission_status(submission_id: int) -> dict[str, Any]:
    """Return current grading status for a submission."""
    with get_session() as session:
        result = session.exec(select(GradingResult).where(GradingResult.submission_id == submission_id)).first()
        if result is None:
            return {"submission_id": submission_id, "status": "pending"}
        return {
            "submission_id": submission_id,
            "status": result.status,
            "needs_teacher_review": result.needs_teacher_review,
            "suggested_score": result.suggested_score,
            "confidence": result.confidence,
            "feedback": result.feedback,
            "final_score": result.final_score,
        }


@router.post("/submissions/{submission_id}/approve", response_model=dict[str, Any], status_code=status.HTTP_200_OK)
def approve_submission(submission_id: int, payload: TeacherApprovalPayload) -> dict[str, Any]:
    """Stores the teacher-approved final score and note."""
    with get_session() as session:
        result = session.exec(select(GradingResult).where(GradingResult.submission_id == submission_id)).first()
        if result is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No grading result found for this submission")

        result.final_score = float(payload.final_score)
        result.teacher_note = payload.teacher_note
        result.status = "approved"
        result.updated_at = result.updated_at
        session.add(result)
        session.commit()
        session.refresh(result)

        return {
            "submission_id": submission_id,
            "status": "approved",
            "final_score": result.final_score,
            "teacher_note": result.teacher_note,
        }
