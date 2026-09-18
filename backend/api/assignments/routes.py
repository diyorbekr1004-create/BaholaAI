from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from backend.database import get_session
from backend.db.models import Assignment

router = APIRouter(prefix="/assignments", tags=["assignments"])


class AssignmentCreate(BaseModel):
    teacher_id: int
    subject_id: int
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="")


@router.post("", response_model=dict[str, Any], status_code=201)
def create_assignment(payload: AssignmentCreate) -> dict[str, Any]:
    """Create an assignment with strict request validation."""
    with get_session() as session:
        assignment = Assignment(
            teacher_id=payload.teacher_id,
            subject_id=payload.subject_id,
            title=payload.title,
            description=payload.description,
        )
        session.add(assignment)
        session.commit()
        session.refresh(assignment)
        return {
            "id": assignment.id,
            "teacher_id": assignment.teacher_id,
            "subject_id": assignment.subject_id,
            "title": assignment.title,
            "description": assignment.description,
            "created_at": assignment.created_at,
            "updated_at": assignment.updated_at,
        }


@router.get("", response_model=list[dict[str, Any]])
def list_assignments() -> list[dict[str, Any]]:
    with get_session() as session:
        assignments = session.exec(select(Assignment)).all()
        return [
            {
                "id": a.id,
                "teacher_id": a.teacher_id,
                "subject_id": a.subject_id,
                "title": a.title,
                "description": a.description,
                "created_at": a.created_at,
                "updated_at": a.updated_at,
            }
            for a in assignments
        ]


@router.get("/{assignment_id}", response_model=dict[str, Any])
def get_assignment(assignment_id: int) -> dict[str, Any]:
    with get_session() as session:
        assignment = session.get(Assignment, assignment_id)
        if assignment is None:
            raise HTTPException(status_code=404, detail="Assignment not found")
        return {
            "id": assignment.id,
            "teacher_id": assignment.teacher_id,
            "subject_id": assignment.subject_id,
            "title": assignment.title,
            "description": assignment.description,
            "created_at": assignment.created_at,
            "updated_at": assignment.updated_at,
        }
