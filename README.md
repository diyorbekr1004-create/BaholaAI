# BaholaAI

BaholaAI — Oliy ta’limda o'qituvchilar uchun AI yordamida topshiriq, rubrika, javob va baholash jarayonini tezlashtirishga qaratilgan demo loyiha.

## Maqsad

- topshiriq yaratish
- rubrika kiritish
- talaba javobini yuklash
- AI tavsiya bahosini olish
- o'qituvchi tasdiqlovi orqali final ballni saqlash
- qaydnoma/export yaratish

## Asosiy oqim

Teacher → Assignment → Rubric → Submission → AI Suggested Score → Teacher Approval → Final Score → Report

## Repo tuzilmasi

- `.github/copilot-instructions.md` — barcha Copilot'lar uchun umumiy qoidalar
- `backend/` — DB, CRUD va API modullari
- `frontend/` — React + Vite + Tailwind UI
- `API_CONTRACT.md` — kelishilgan API shartnomasi
- `docs/` — A/B/C jamoa prompt fayllari

## MVP doirasi

- demo teacher login
- assignment/rubric management
- file upload (text/PDF/image)
- AI grading proposal
- teacher approval/edit/regrade flow
- simple cohort statistics
- report export

## Boshqa qoidalarga makhsox

- AI faqat tavsiya beradi, yakuniy baho har doim o'qituvchida qoladi.
- Structured JSON natija majburiydir.
- Scope'ga zid funksiyalar qabul qilinmaydi.
- Har bir vazifa uchun kelishilgan API contract asosida ishlanadi.
