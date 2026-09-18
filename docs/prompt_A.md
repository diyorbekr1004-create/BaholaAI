# Prompt A — Backend Core

## Roli
A modul — ma’lumotlar bazasi, CRUD operatsiyalar, submission upload va asosiy backend API qismini tayyorlaydi.

## Majburiy vazifalar
1. SQLModel bilan SQLite DB va minimal entity'larni yaratish.
2. User, Subject, Assignment, Rubric, RubricCriterion, Submission modellari uchun CRUD endpointlarini qo'shish.
3. File upload handler yaratish: matn/PDF/DOCX/JPG/PNG qabul qilishi.
4. `POST /assignments`, `GET /assignments`, `POST /assignments/{id}/rubric`, `POST /assignments/{id}/submissions` ishlashi.
5. Serverda xatolik kodlari (`INVALID_FILE`, `RUBRIC_INVALID`, `AUTH_ERROR`) uchun tushunarli javoblarni qaytarish.
6. Har bir model uchun `created_at` va `updated_at` maydonlarini qo'shish.

## Qoidalar
- Python 3.11+, FastAPI, SQLModel, Pydantic v2 ishlatish.
- Type hints majburiy.
- Magic number ishlatmang; qiymatlarni config/env orqali boshqaring.
- Silent fail qilish mumkin emas; xatolik logga yozilsin.
- Har bir API JSON formatini `API_CONTRACT.md` bo'yicha saqlang.

## Ish boshlash usuli
- API contract birinchi bo'lib kelishiladi.
- Keyin model va CRUD tayyorlanadi.
- Oxirida submission upload va validatsiya test qilinadi.

## Tekshiruv mezonlari
- endpointlar contract bilan mos keladi
- `POST /submissions` faylni qabul qiladi
- `POST /assignments/{id}/rubric` rubric ma’lumotini saqlaydi
- `GET /assignments` ro'yxat qaytaradi
