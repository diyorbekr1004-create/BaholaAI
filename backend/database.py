from __future__ import annotations

from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine, select

DB_PATH = Path(__file__).resolve().parent / "baholaai.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})


def init_db() -> None:
    """Create database tables and seed a minimal demo teacher and subject."""
    from backend.db.grading_models import GradingResult
    from backend.db.models import Assignment, Rubric, RubricCriterion, Subject, Submission, Teacher

    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        existing_teacher = session.exec(select(Teacher).where(Teacher.email == "demo@baholaai.uz")).first()
        if existing_teacher is None:
            teacher = Teacher(name="Demo Teacher", email="demo@baholaai.uz")
            session.add(teacher)
            session.commit()
            session.refresh(teacher)
        else:
            teacher = existing_teacher

        existing_subject = session.exec(select(Subject).where(Subject.name == "Dasturlash asoslari")).first()
        if existing_subject is None:
            subject = Subject(name="Dasturlash asoslari")
            session.add(subject)
            session.commit()
            session.refresh(subject)


def get_session() -> Session:
    return Session(engine)
