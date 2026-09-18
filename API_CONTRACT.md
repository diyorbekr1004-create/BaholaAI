# API CONTRACT — BaholaAI

## Assignments (A)

### POST /assignments
Request JSON:
```json
{
  "teacher_id": 1,
  "subject_id": 1,
  "title": "Topshiriq nomi",
  "description": "Topshiriq matni"
}
```

Response 201:
```json
{
  "id": 5,
  "teacher_id": 1,
  "subject_id": 1,
  "title": "Topshiriq nomi",
  "description": "Topshiriq matni",
  "created_at": "2026-09-18T10:00:00Z",
  "updated_at": "2026-09-18T10:00:00Z"
}
```

### GET /assignments
Response 200:
```json
[
  {
    "id": 5,
    "teacher_id": 1,
    "subject_id": 1,
    "title": "Topshiriq nomi",
    "description": "Topshiriq matni",
    "created_at": "2026-09-18T10:00:00Z",
    "updated_at": "2026-09-18T10:00:00Z"
  }
]
```

### GET /assignments/{id}
Response 200:
```json
{
  "id": 5,
  "teacher_id": 1,
  "subject_id": 1,
  "title": "Topshiriq nomi",
  "description": "Topshiriq matni",
  "created_at": "2026-09-18T10:00:00Z",
  "updated_at": "2026-09-18T10:00:00Z"
}
```

## Rubric (A)

### POST /assignments/{id}/rubric
Request JSON:
```json
{
  "version": "v1",
  "criteria": [
    {"name": "Talabalilik", "max_score": 30},
    {"name": "Tahlil", "max_score": 40},
    {"name": "Hujjatlash", "max_score": 30}
  ]
}
```

Response 201:
```json
{
  "id": 7,
  "assignment_id": 5,
  "version": "v1",
  "criteria": [
    {"id": 1, "name": "Talabalilik", "max_score": 30},
    {"id": 2, "name": "Tahlil", "max_score": 40},
    {"id": 3, "name": "Hujjatlash", "max_score": 30}
  ]
}
```

### GET /assignments/{id}/rubric
Response 200:
```json
{
  "id": 7,
  "assignment_id": 5,
  "version": "v1",
  "criteria": [
    {"id": 1, "name": "Talabalilik", "max_score": 30},
    {"id": 2, "name": "Tahlil", "max_score": 40},
    {"id": 3, "name": "Hujjatlash", "max_score": 30}
  ]
}
```

## Submissions (A)

### POST /assignments/{id}/submissions
Request: multipart/form-data
- `file`: uploaded file
- `student_name`: "Talaba Ismi"

Response 201:
```json
{
  "id": 12,
  "assignment_id": 5,
  "student_name": "Talaba Ismi",
  "file_name": "answer.pdf",
  "file_path": "C:/.../backend/uploads/5_answer.pdf",
  "status": "uploaded",
  "created_at": "2026-09-18T10:00:00Z",
  "updated_at": "2026-09-18T10:00:00Z"
}
```

### GET /submissions/{id}
Response 200:
```json
{
  "id": 12,
  "assignment_id": 5,
  "student_name": "Talaba Ismi",
  "file_path": "C:/.../backend/uploads/5_answer.pdf",
  "status": "uploaded",
  "created_at": "2026-09-18T10:00:00Z",
  "updated_at": "2026-09-18T10:00:00Z"
}
```

## Error responses

### 400 Bad Request
```json
{
  "detail": "Unsupported file type. Allowed: pdf, docx, txt, jpg, jpeg, png"
}
```

### 404 Not Found
```json
{
  "detail": "Assignment not found"
}
```

## Grading and review (B)

### POST /submissions/{id}/grade
Response 202:
```json
{
  "submission_id": 12,
  "status": "pending",
  "message": "Grading started in the background."
}
```

### GET /submissions/{id}/status
Response 200:
```json
{
  "submission_id": 12,
  "status": "done",
  "needs_teacher_review": false,
  "suggested_score": 8.5,
  "confidence": 0.82,
  "feedback": "The answer is generally aligned with the rubric and demonstrates adequate coverage of the task.",
  "final_score": null
}
```

### POST /submissions/{id}/approve
Request JSON:
```json
{
  "final_score": 9.0,
  "teacher_note": "Strong structure and relevant examples."
}
```

Response 200:
```json
{
  "submission_id": 12,
  "status": "approved",
  "final_score": 9.0,
  "teacher_note": "Strong structure and relevant examples."
}
```

## Notes
- Allowed file extensions: `pdf`, `docx`, `txt`, `jpg`, `jpeg`, `png`.
- Max upload size: `10 MB`.
- Files are stored under `backend/uploads/` and only the path is saved in the DB.
- AI grading and frontend will use this contract directly.
- `needs_teacher_review = true` is allowed when confidence is below `0.70` or the grading payload is invalid.
- `suggested_score` is never automatically promoted to `final_score` without teacher approval.
