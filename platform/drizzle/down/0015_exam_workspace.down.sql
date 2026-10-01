-- تراجع عن 0015_exam_workspace: يزيل أعمدة الورشة فقط؛ الامتحانات وعناصرها تبقى.
-- الاستعمال (بعد نسخة احتياطية): psql "$DATABASE_URL" -f drizzle/down/0015_exam_workspace.down.sql
-- ثم احذف سطر 0015 من drizzle.__drizzle_migrations إن أردت إعادة تطبيقها لاحقاً.
BEGIN;
DROP INDEX IF EXISTS "exams_group_idx";
DROP INDEX IF EXISTS "exams_template_idx";
ALTER TABLE "exams" DROP CONSTRAINT IF EXISTS "exams_group_id_groups_id_fk";
ALTER TABLE "exams" DROP COLUMN IF EXISTS "last_printed_at";
ALTER TABLE "exams" DROP COLUMN IF EXISTS "print_count";
ALTER TABLE "exams" DROP COLUMN IF EXISTS "group_id";
ALTER TABLE "exams" DROP COLUMN IF EXISTS "is_template";
COMMIT;
