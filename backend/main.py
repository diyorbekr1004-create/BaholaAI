from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from pydantic import BaseModel

from backend.api.assignments.routes import router as assignments_router
from backend.api.grading.routes import router as grading_router
from backend.api.rubrics.routes import router as rubrics_router
from backend.api.submissions.routes import router as submissions_router
from backend.database import init_db

load_dotenv()

app = FastAPI(title="BaholaAI Backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assignments_router)
app.include_router(rubrics_router)
app.include_router(submissions_router)
app.include_router(grading_router)


class ChatRequest(BaseModel):
    message: str
    context: str | None = None


def _fallback_chat_reply(message: str) -> str:
    return (
        "AI yordamchisi hozirgi anda Google Gemini kalitini topa olmadi yoki API so'rovi bajarilmadi. "
        "Iltimos, .env faylida GEMINI_API_KEY ni kiritib, serverni qayta ishga tushiring. "
        f"Savolingiz: {message[:220]}"
    )


def _candidate_gemini_models() -> list[str]:
    preferred = os.getenv("GEMINI_MODEL")
    candidates: list[str] = []
    if preferred:
        candidates.append(preferred)
    for model_name in (
        "gemini-3.6-flash",
        "gemini-2.5-flash",
        "gemini-flash-latest",
    ):
        if model_name not in candidates:
            candidates.append(model_name)
    return candidates


def _gemini_reply(message: str, context: str | None = None) -> str:
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        return _fallback_chat_reply(message)

    try:
        client = genai.Client(api_key=api_key)
        system_prompt = (
            "Siz OTM (Oliy ta'lim muassasalari) uchun umumiy professor-o'qituvchi yordamchisiz. "
            "Siz har qanday fan bo'yicha talaba ishlarini baholash, ta'lim materiallarini tahlil qilish, "
            "ilmiy-pedagogik maslahatlar berish va o'qituvchiga aniq, foydali tavsiyalar berishga tayyorsiz. "
            "Har doim maxsus fan bo'yicha biror qoidani ixtiro qilmang; faqat mavjud ta'lim metodologiyasi, "
            "rubrika va pedagogik yondashuvga asoslaning."
        )
        context_text = context or "Umumiy ta'lim va baholash"
        prompt = "\n\n".join([
            system_prompt,
            f"Kontext: {context_text}",
            f"Foydalanuvchi savoli: {message}",
        ])

        for model_name in _candidate_gemini_models():
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                text = getattr(response, "text", "")
                if not text and hasattr(response, "candidates"):
                    parts = getattr(response.candidates[0].content, "parts", [])
                    if parts:
                        text = getattr(parts[0], "text", "")
                if text and text.strip():
                    return text.strip()
            except Exception:
                continue
    except Exception:
        pass

    return _fallback_chat_reply(message)


@app.on_event("startup")
def startup_event() -> None:
    init_db()


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/chat")
@app.post("/ai/chat")
def chat_endpoint(request: ChatRequest) -> dict[str, str]:
    message = (request.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Xabar matni bo'sh bo'lishi mumkin emas.")

    reply = _gemini_reply(message, request.context)
    return {"reply": reply}
