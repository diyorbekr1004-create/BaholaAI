from __future__ import annotations

from pydantic import BaseModel, Field


class CriterionResult(BaseModel):
    name: str
    score: float
    max_score: float
    comment: str


class GradingResult(BaseModel):
    suggested_score: float = Field(..., ge=0)
    max_score: float = Field(..., gt=0)
    confidence: float = Field(..., ge=0, le=1)
    criteria: list[CriterionResult]
    strengths: list[str]
    mistakes: list[str]
    feedback: str
    needs_teacher_review: bool
