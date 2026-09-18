from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlmodel import Session, select

from backend.ai_gateway.client import AIProviderError, AI_PROVIDER_ERROR, call_llm
from backend.database import get_session
from backend.db.grading_models import GradingResult
from backend.db.models import Assignment, Rubric, RubricCriterion, Submission
from backend.grading_engine.prompt import build_grading_prompt
from backend.grading_engine.schemas import GradingResult as GradingResponseModel


def _serialize_for_db(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _build_rubric_payload(rubric: Rubric | None, session: Session) -> list[dict[str, Any]]:
    if rubric is None:
        return []
    criteria = session.exec(select(RubricCriterion).where(RubricCriterion.rubric_id == rubric.id)).all()
    return [
        {"name": criterion.name, "max_score": float(criterion.max_score)}
        for criterion in criteria
    ]


def _read_submission_text(submission: Submission) -> str:
    file_path = submission.file_path
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as fh:
            return fh.read()
    except OSError:
        return ""


def grade_submission(submission_id: int) -> GradingResponseModel:
    """Grade one submission using rubric and LLM, returning the structured JSON result."""
    with get_session() as session:
        submission = session.get(Submission, submission_id)
        if submission is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

        assignment = session.get(Assignment, submission.assignment_id)
        if assignment is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

        rubric = session.exec(select(Rubric).where(Rubric.assignment_id == submission.assignment_id)).first()
        rubric_payload = _build_rubric_payload(rubric, session)
        assignment_text = assignment.description or assignment.title
        answer_text = _read_submission_text(submission)
        prompt = build_grading_prompt(assignment_text, rubric_payload, answer_text)

        try:
            raw_response = call_llm(prompt=prompt, student_answer=answer_text, rubric=rubric_payload, file_path=submission.file_path)
        except AIProviderError as exc:
            result = GradingResponseModel(
                suggested_score=0.0,
                max_score=float(sum(item.get("max_score", 0.0) for item in rubric_payload)) if rubric_payload else 10.0,
                confidence=0.0,
                criteria=[
                    {"name": item.get("name", "Criterion"), "score": 0.0, "max_score": float(item.get("max_score", 0.0)), "comment": "AI provider unavailable; teacher review required."}
                    for item in rubric_payload
                ] if rubric_payload else [{"name": "General quality", "score": 0.0, "max_score": 10.0, "comment": "AI provider unavailable; teacher review required."}],
                strengths=[],
                mistakes=["AI provider unavailable during grading."],
                feedback="The grading service could not complete automatic evaluation. Please review manually.",
                needs_teacher_review=True,
            )
            return result

        if not isinstance(raw_response, dict):
            raise ValueError("AI response is not a dictionary")

        try:
            validated = GradingResponseModel.model_validate(raw_response)
        except Exception:
            validated = GradingResponseModel(
                suggested_score=0.0,
                max_score=float(sum(item.get("max_score", 0.0) for item in rubric_payload)) if rubric_payload else 10.0,
                confidence=0.0,
                criteria=[
                    {"name": item.get("name", "Criterion"), "score": 0.0, "max_score": float(item.get("max_score", 0.0)), "comment": "Invalid model output; teacher review required."}
                    for item in rubric_payload
                ] if rubric_payload else [{"name": "General quality", "score": 0.0, "max_score": 10.0, "comment": "Invalid model output; teacher review required."}],
                strengths=[],
                mistakes=["AI output failed validation."],
                feedback="The AI returned an invalid grading payload. Teacher review is required.",
                needs_teacher_review=True,
            )

        if validated.confidence < 0.70 or validated.needs_teacher_review:
            validated.needs_teacher_review = True

        return validated


def run_grading_job(submission_id: int) -> None:
    """Background job entry point: grade a submission and persist the result in the database."""
    with get_session() as session:
        existing = session.exec(select(GradingResult).where(GradingResult.submission_id == submission_id)).first()
        if existing is None:
            result_row = GradingResult(
                submission_id=submission_id,
                rubric_version="v1",
                status="pending",
            )
            session.add(result_row)
            session.commit()
            session.refresh(result_row)
            record_id = result_row.id
        else:
            record_id = existing.id

    try:
        validated = grade_submission(submission_id)
    except Exception:
        with get_session() as session:
            record = session.get(GradingResult, record_id)
            if record is not None:
                record.status = "failed"
                record.needs_teacher_review = True
                record.feedback = "The grading job failed and requires manual review."
                record.updated_at = datetime.now(timezone.utc)
                session.add(record)
                session.commit()
        return

    with get_session() as session:
        record = session.get(GradingResult, record_id)
        if record is None:
            record = GradingResult(submission_id=submission_id)
            session.add(record)
        record.rubric_version = "v1"
        record.suggested_score = float(validated.suggested_score)
        record.max_score = float(validated.max_score)
        record.confidence = float(validated.confidence)
        record.criteria_json = _serialize_for_db([criterion.model_dump() for criterion in validated.criteria])
        record.strengths_json = _serialize_for_db(validated.strengths)
        record.mistakes_json = _serialize_for_db(validated.mistakes)
        record.feedback = validated.feedback
        record.needs_teacher_review = bool(validated.needs_teacher_review)
        record.status = "done" if not validated.needs_teacher_review else "pending"
        record.final_score = None
        record.updated_at = datetime.now(timezone.utc)
        session.add(record)
        session.commit()
