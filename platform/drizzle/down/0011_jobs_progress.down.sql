-- تراجع عن 0011_jobs_progress: يزيل أعمدة التقدّم فقط؛ صفوف المهام ونتائجها تبقى.
-- الاستعمال (بعد نسخة احتياطية): psql "$DATABASE_URL" -f drizzle/down/0011_jobs_progress.down.sql
-- ثم احذف سطر 0011 من drizzle.__drizzle_migrations إن أردت إعادة تطبيقها لاحقاً.
BEGIN;
DROP INDEX IF EXISTS "jobs_type_created_idx";
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "logs";
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "failed_items";
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "processed_items";
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "total_items";
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "progress";
COMMIT;
