from __future__ import annotations

from fastapi import FastAPI

from backend.api.assignments.routes import router as assignments_router
from backend.api.grading.routes import router as grading_router
from backend.api.rubrics.routes import router as rubrics_router
from backend.api.submissions.routes import router as submissions_router
from backend.database import init_db

app = FastAPI(title="BaholaAI Backend", version="0.1.0")

app.include_router(assignments_router)
app.include_router(rubrics_router)
app.include_router(submissions_router)
app.include_router(grading_router)


@app.on_event("startup")
def startup_event() -> None:
    init_db()


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
