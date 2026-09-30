-- تراجع عن 0012_youtube_directory: يزيل دليل الأساتذة وعمود educator_id فقط.
-- فيديوهات resources المستوردة تبقى (بلا ربط بأستاذ) ويمكن أرشفتها من الإدارة.
-- الاستعمال (بعد نسخة احتياطية): psql "$DATABASE_URL" -f drizzle/down/0012_youtube_directory.down.sql
-- ثم احذف سطر 0012 من drizzle.__drizzle_migrations إن أردت إعادة تطبيقها لاحقاً.
BEGIN;
DROP INDEX IF EXISTS "resources_educator_idx";
ALTER TABLE "resources" DROP CONSTRAINT IF EXISTS "resources_educator_id_educators_id_fk";
ALTER TABLE "resources" DROP COLUMN IF EXISTS "educator_id";
DROP TABLE IF EXISTS "educator_subjects";
DROP TABLE IF EXISTS "educators";
COMMIT;
