-- تراجع عن 0016_practice: يزيل جلسات التدريب الذاتي وإجاباتها فقط؛ البنك لا يُمسّ.
-- الاستعمال (بعد نسخة احتياطية): psql "$DATABASE_URL" -f drizzle/down/0016_practice.down.sql
-- ثم احذف سطر 0016 من drizzle.__drizzle_migrations إن أردت إعادة تطبيقها لاحقاً.
BEGIN;
DROP TABLE IF EXISTS "practice_answers";
DROP TABLE IF EXISTS "practice_sessions";
COMMIT;
