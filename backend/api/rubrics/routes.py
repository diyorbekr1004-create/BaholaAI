from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import select

from backend.database import get_session
from backend.db.models import Assignment, Rubric, RubricCriterion

router = APIRouter(prefix="/assignments", tags=["rubrics"])


class RubricCriterionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    max_score: int = Field(..., gt=0)


class RubricCreate(BaseModel):
    version: str = Field(default="v1", min_length=1, max_length=50)
    criteria: list[RubricCriterionCreate] = Field(..., min_length=1)


@router.post("/{assignment_id}/rubric", response_model=dict[str, Any], status_code=status.HTTP_201_CREATED)
def create_rubric_for_assignment(assignment_id: int, payload: RubricCreate) -> dict[str, Any]:
    """Create a rubric and its criteria for the given assignment."""
    with get_session() as session:
        assignment = session.get(Assignment, assignment_id)
        if assignment is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

        rubric = Rubric(assignment_id=assignment.id, version=payload.version)
        session.add(rubric)
        session.commit()
        session.refresh(rubric)

        saved_criteria: list[dict[str, Any]] = []
        for criterion in payload.criteria:
            item = RubricCriterion(
                rubric_id=rubric.id,
                name=criterion.name,
                max_score=criterion.max_score,
            )
            session.add(item)
            session.commit()
            session.refresh(item)
            saved_criteria.append({"id": item.id, "name": item.name, "max_score": item.max_score})

        return {
            "id": rubric.id,
            "assignment_id": rubric.assignment_id,
            "version": rubric.version,
            "criteria": saved_criteria,
        }


@router.get("/{assignment_id}/rubric", response_model=dict[str, Any], status_code=status.HTTP_200_OK)
def get_rubric_for_assignment(assignment_id: int) -> dict[str, Any]:
    """Return rubric data for a given assignment."""
    with get_session() as session:
        assignment = session.get(Assignment, assignment_id)
        if assignment is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

        rubric = session.exec(select(Rubric).where(Rubric.assignment_id == assignment_id)).first()
        if rubric is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rubric not found")

        criteria = session.exec(select(RubricCriterion).where(RubricCriterion.rubric_id == rubric.id)).all()
        return {
            "id": rubric.id,
            "assignment_id": rubric.assignment_id,
            "version": rubric.version,
            "criteria": [
                {"id": c.id, "name": c.name, "max_score": c.max_score}
                for c in criteria
            ],
        }
