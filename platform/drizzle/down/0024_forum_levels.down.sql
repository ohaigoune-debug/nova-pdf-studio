-- تراجع عن 0024_forum_levels: يحذف المنتدى (بكل مواضيعه وردوده) وعمودَي الدرس الموحّد ومستوى الاختبارات.
-- الاستعمال (بعد نسخة احتياطية): psql "$DATABASE_URL" -f drizzle/down/0024_forum_levels.down.sql
BEGIN;
DROP INDEX IF EXISTS "resources_lesson_idx";
ALTER TABLE "resources" DROP COLUMN IF EXISTS "lesson_title";
ALTER TABLE "resources" DROP COLUMN IF EXISTS "lesson_key";
ALTER TABLE "quizzes" DROP CONSTRAINT IF EXISTS "quizzes_level_id_levels_id_fk";
ALTER TABLE "quizzes" DROP COLUMN IF EXISTS "level_id";
DROP TABLE IF EXISTS "forum_posts";
DROP TABLE IF EXISTS "forum_threads";
COMMIT;
