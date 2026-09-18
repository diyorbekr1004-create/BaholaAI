from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel


class Teacher(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    email: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    assignments: list["Assignment"] = Relationship(back_populates="teacher")


class Subject(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    assignments: list["Assignment"] = Relationship(back_populates="subject")


class Assignment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    teacher_id: int = Field(foreign_key="teacher.id", index=True)
    subject_id: int = Field(foreign_key="subject.id", index=True)
    title: str = Field(index=True)
    description: str = Field(default="")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    teacher: Optional[Teacher] = Relationship(back_populates="assignments")
    subject: Optional[Subject] = Relationship(back_populates="assignments")
    rubric: Optional["Rubric"] = Relationship(back_populates="assignment")
    submissions: list["Submission"] = Relationship(back_populates="assignment")


class Rubric(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    assignment_id: int = Field(foreign_key="assignment.id", unique=True, index=True)
    version: str = Field(default="v1")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    assignment: Optional[Assignment] = Relationship(back_populates="rubric")
    criteria: list["RubricCriterion"] = Relationship(back_populates="rubric")


class RubricCriterion(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    rubric_id: int = Field(foreign_key="rubric.id", index=True)
    name: str = Field(index=True)
    max_score: int = Field(default=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    rubric: Optional[Rubric] = Relationship(back_populates="criteria")


class Submission(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    assignment_id: int = Field(foreign_key="assignment.id", index=True)
    student_name: str = Field(index=True)
    file_path: str
    status: str = Field(default="uploaded")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    assignment: Optional[Assignment] = Relationship(back_populates="submissions")
