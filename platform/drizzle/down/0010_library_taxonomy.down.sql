-- تراجع عن 0010_library_taxonomy: يزيل الجداول والأعمدة الجديدة فقط.
-- لا يلمس أي بيانات سابقة (المستويات والشعب والمهارات تبقى بأعمدتها القديمة).
-- الاستعمال (بعد نسخة احتياطية): psql "$DATABASE_URL" -f drizzle/down/0010_library_taxonomy.down.sql
-- ثم احذف سطر 0010 من drizzle.__drizzle_migrations إن أردت إعادة تطبيقها لاحقاً.
BEGIN;
DROP TABLE IF EXISTS "resource_groups";
DROP TABLE IF EXISTS "resources";
DROP TABLE IF EXISTS "content_sources";
ALTER TABLE "skills" DROP COLUMN IF EXISTS "curriculum_node_id";
ALTER TABLE "skills" DROP COLUMN IF EXISTS "subject_id";
DROP TABLE IF EXISTS "curriculum_nodes";
DROP TABLE IF EXISTS "subject_offerings";
DROP TABLE IF EXISTS "grade_streams";
DROP TABLE IF EXISTS "curriculum_versions";
ALTER TABLE "streams" DROP COLUMN IF EXISTS "parent_id";
ALTER TABLE "streams" DROP COLUMN IF EXISTS "slug";
ALTER TABLE "levels" DROP COLUMN IF EXISTS "stage_id";
ALTER TABLE "levels" DROP COLUMN IF EXISTS "slug";
DROP TABLE IF EXISTS "subjects";
DROP TABLE IF EXISTS "education_stages";
COMMIT;
