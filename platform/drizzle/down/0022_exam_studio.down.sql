-- تراجع عن 0022_exam_studio: يزيل المراجعات ومكتبة الأستاذ وأعمدة التخطيط/المفضّلة ويعيد قيد نوع العنصر.
-- تحذير: عناصر الورقة من نوع BLOCK تُحذف (لا تقبلها النسخة السابقة). الاستعمال بعد نسخة احتياطية:
--   psql "$DATABASE_URL" -f drizzle/down/0022_exam_studio.down.sql
-- ثم احذف سطر 0022 من drizzle.__drizzle_migrations إن أردت إعادة تطبيقها لاحقاً.
BEGIN;
DROP INDEX IF EXISTS "exams_favorite_idx";
DROP TABLE IF EXISTS "teacher_library_items";
DROP TABLE IF EXISTS "exam_revisions";
ALTER TABLE "exams" DROP COLUMN IF EXISTS "is_favorite";
ALTER TABLE "exams" DROP COLUMN IF EXISTS "layout";
DELETE FROM "exam_items" WHERE "kind" = 'BLOCK';
ALTER TABLE "exam_items" DROP CONSTRAINT IF EXISTS "exam_items_kind_check";
ALTER TABLE "exam_items" ADD CONSTRAINT "exam_items_kind_check" CHECK ("kind" IN ('EXERCISE', 'QUESTION', 'TEXT', 'PAGE_BREAK'));
COMMIT;
