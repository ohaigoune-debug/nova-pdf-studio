-- تراجع عن 0023_bac_bank: يزيل أعمدة بنك البكالوريا والحلّ المفصّل ويعيد قيد الحالة (الوثائق «الموثَّقة» تعود «بانتظار المراجعة»).
-- الاستعمال (بعد نسخة احتياطية): psql "$DATABASE_URL" -f drizzle/down/0023_bac_bank.down.sql
BEGIN;
DROP INDEX IF EXISTS "bank_questions_solution_detail_idx";
ALTER TABLE "bank_questions" DROP COLUMN IF EXISTS "solution_detail";
DROP INDEX IF EXISTS "exam_documents_pdf_hash_idx";
DROP INDEX IF EXISTS "exam_documents_bac_key_idx";
UPDATE "exam_documents" SET "status" = 'NEEDS_REVIEW' WHERE "status" = 'VERIFIED';
ALTER TABLE "exam_documents" DROP CONSTRAINT IF EXISTS "exam_documents_status_check";
ALTER TABLE "exam_documents" ADD CONSTRAINT "exam_documents_status_check" CHECK ("status" IN ('PENDING', 'PROCESSING', 'NEEDS_REVIEW', 'PUBLISHED', 'FAILED'));
ALTER TABLE "exam_documents" DROP CONSTRAINT IF EXISTS "exam_documents_verified_by_user_id_users_id_fk";
ALTER TABLE "exam_documents" DROP COLUMN IF EXISTS "verified_at";
ALTER TABLE "exam_documents" DROP COLUMN IF EXISTS "verified_by_user_id";
ALTER TABLE "exam_documents" DROP COLUMN IF EXISTS "quality";
ALTER TABLE "exam_documents" DROP COLUMN IF EXISTS "solution_pdf_hash";
ALTER TABLE "exam_documents" DROP COLUMN IF EXISTS "pdf_hash";
ALTER TABLE "exam_documents" DROP COLUMN IF EXISTS "pages_count";
ALTER TABLE "exam_documents" DROP COLUMN IF EXISTS "language";
ALTER TABLE "exam_documents" DROP COLUMN IF EXISTS "topic_number";
COMMIT;
