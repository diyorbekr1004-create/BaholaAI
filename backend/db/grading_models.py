from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class GradingResult(SQLModel, table=True):
    __tablename__ = "grading_result"

    id: Optional[int] = Field(default=None, primary_key=True)
    submission_id: int = Field(index=True, unique=True)
    rubric_version: str = Field(default="v1")
    suggested_score: float = Field(default=0.0)
    max_score: float = Field(default=0.0)
    confidence: float = Field(default=0.0)
    criteria_json: str = Field(default="[]")
    strengths_json: str = Field(default="[]")
    mistakes_json: str = Field(default="[]")
    feedback: str = Field(default="")
    needs_teacher_review: bool = Field(default=False)
    status: str = Field(default="pending")
    final_score: Optional[float] = Field(default=None)
    teacher_note: str = Field(default="")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
