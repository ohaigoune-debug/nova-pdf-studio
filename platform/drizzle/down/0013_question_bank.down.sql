-- تراجع عن 0013_question_bank: يزيل بنك الأسئلة والمفضّلة فقط؛ اختبارات quizzes وأسئلتها لا تُمسّ.
-- الاستعمال (بعد نسخة احتياطية): psql "$DATABASE_URL" -f drizzle/down/0013_question_bank.down.sql
-- ثم احذف سطر 0013 من drizzle.__drizzle_migrations إن أردت إعادة تطبيقها لاحقاً.
BEGIN;
DROP TABLE IF EXISTS "bank_favorites";
DROP TABLE IF EXISTS "bank_questions";
COMMIT;
