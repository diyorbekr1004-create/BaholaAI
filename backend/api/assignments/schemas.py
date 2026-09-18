from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AssignmentCreate(BaseModel):
    teacher_id: int = Field(..., ge=1)
    subject_id: int = Field(..., ge=1)
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="")


class AssignmentRead(BaseModel):
    id: int
    teacher_id: int
    subject_id: int
    title: str
    description: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AssignmentDetail(AssignmentRead):
    rubric: Optional[dict] = None
    submissions: list[dict] = []
