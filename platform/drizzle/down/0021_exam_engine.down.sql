-- تراجع عن 0021_exam_engine: يزيل جداول المحرّك وأعمدة الأصل على بنك الأسئلة. أسئلة البنك نفسها تبقى.
-- الاستعمال (بعد نسخة احتياطية): psql "$DATABASE_URL" -f drizzle/down/0021_exam_engine.down.sql
-- ثم احذف سطر 0021 من drizzle.__drizzle_migrations إن أردت إعادة تطبيقها لاحقاً.
BEGIN;
DROP INDEX IF EXISTS "bank_questions_origin_idx";
DROP INDEX IF EXISTS "bank_questions_document_idx";
ALTER TABLE "bank_questions" DROP CONSTRAINT IF EXISTS "bank_questions_document_id_exam_documents_id_fk";
ALTER TABLE "bank_questions" DROP CONSTRAINT IF EXISTS "bank_questions_origin_check";
ALTER TABLE "bank_questions" DROP COLUMN IF EXISTS "skills";
ALTER TABLE "bank_questions" DROP COLUMN IF EXISTS "ai_confidence";
ALTER TABLE "bank_questions" DROP COLUMN IF EXISTS "source_topic_no";
ALTER TABLE "bank_questions" DROP COLUMN IF EXISTS "source_exercise_no";
ALTER TABLE "bank_questions" DROP COLUMN IF EXISTS "document_id";
ALTER TABLE "bank_questions" DROP COLUMN IF EXISTS "origin";
DROP TABLE IF EXISTS "exam_feedback";
DROP TABLE IF EXISTS "ai_usage_logs";
DROP TABLE IF EXISTS "teacher_progress";
DROP TABLE IF EXISTS "exam_documents";
COMMIT;
