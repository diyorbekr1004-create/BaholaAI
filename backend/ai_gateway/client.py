from __future__ import annotations

import base64
import json
import mimetypes
import os
from pathlib import Path
from typing import Any

import requests

AI_PROVIDER_ERROR = "AI_PROVIDER_ERROR"


class AIProviderError(RuntimeError):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


def _build_vision_content(prompt: str, file_path: str | None) -> list[dict[str, Any]]:
    content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
    if not file_path:
        return content

    path = Path(file_path)
    suffix = path.suffix.lower()
    if suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
        return content

    mime_type, _ = mimetypes.guess_type(str(path))
    if mime_type is None:
        mime_type = "image/png"

    with open(path, "rb") as handle:
        encoded = base64.b64encode(handle.read()).decode("utf-8")

    content.append({
        "type": "image_url",
        "image_url": {"url": f"data:{mime_type};base64,{encoded}"},
    })
    return content


def _heuristic_response(student_answer: str, rubric: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    answer_text = (student_answer or "").strip()
    criteria = rubric or []
    total_max = float(sum(float(item.get("max_score", 0)) for item in criteria)) if criteria else 10.0
    answer_quality = min(1.0, max(0.0, len(answer_text) / 350.0))
    score = round(total_max * answer_quality, 2)
    if not criteria:
        criteria = [{"name": "General quality", "max_score": 10.0}]
        total_max = 10.0
    criterion_items: list[dict[str, Any]] = []
    for item in criteria:
        name = str(item.get("name", "Criterion"))
        max_score = float(item.get("max_score", 0.0) or 0.0)
        criterion_score = round(max_score * (0.75 if answer_quality > 0.5 else 0.35), 2)
        comment = "Answer meets the criterion well." if answer_quality > 0.5 else "The answer is brief or incomplete for this criterion."
        criterion_items.append(
            {
                "name": name,
                "score": criterion_score,
                "max_score": max_score,
                "comment": comment,
            }
        )
    if answer_quality < 0.5:
        mistakes = ["The response is incomplete, brief, or missing key points."]
        strengths = ["The answer was attempted and included some relevant content."]
        feedback = "The answer is too short or incomplete to be considered fully satisfactory. Please review it before final approval."
        needs_teacher_review = True
        confidence = 0.62
    else:
        mistakes = []
        strengths = ["The response addresses the key task and uses a clear structure."]
        feedback = "The answer is generally aligned with the rubric and demonstrates adequate coverage of the task."
        needs_teacher_review = False
        confidence = 0.82
    return {
        "suggested_score": score,
        "max_score": total_max,
        "confidence": confidence,
        "criteria": criterion_items,
        "strengths": strengths,
        "mistakes": mistakes,
        "feedback": feedback,
        "needs_teacher_review": needs_teacher_review,
    }


def _extract_json_payload(content: str) -> dict[str, Any]:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        cleaned = cleaned[start : end + 1]
    return json.loads(cleaned)


def call_llm(prompt: str, student_answer: str = "", rubric: list[dict[str, Any]] | None = None, file_path: str | None = None) -> dict[str, Any]:
    """Call the configured LLM or fall back to a deterministic local heuristic for demos without an API key."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return _heuristic_response(student_answer, rubric)

    model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    url = os.getenv("OPENAI_API_URL", "https://api.openai.com/v1/chat/completions")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model_name,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": "You are a strict grading assistant. Return ONLY valid JSON matching the provided schema. Never include markdown wrappers or extra text.",
            },
            {
                "role": "user",
                "content": _build_vision_content(prompt, file_path),
            },
        ],
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        data = response.json()
    except (requests.RequestException, ValueError, json.JSONDecodeError) as exc:
        raise AIProviderError(f"{AI_PROVIDER_ERROR}: LLM request failed: {exc}") from exc

    try:
        content = data["choices"][0]["message"]["content"]
        parsed = _extract_json_payload(content)
        if not isinstance(parsed, dict):
            raise ValueError("LLM response was not a JSON object")
        return parsed
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise AIProviderError(f"{AI_PROVIDER_ERROR}: Invalid LLM response payload") from exc
