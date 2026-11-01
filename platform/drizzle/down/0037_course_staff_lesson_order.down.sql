-- تراجع عن 0037_course_staff_lesson_order. بعد نسخة احتياطية فقط:
--   psql "$DATABASE_URL" -f drizzle/down/0037_course_staff_lesson_order.down.sql
-- ثم احذف سطرها من سجل الترحيلات، وإلا لن تُطبَّق من جديد عند إعادة نشر هذه النسخة:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1793700000000;
-- يفقد: إسناد الدورات لرافعي المحتوى، والترتيب اليدوي للدروس (يعود الترتيب من العنوان وتاريخ النشر).
-- لا يحذف حسابات رافعي المحتوى آليًّا: أوقفها أو غيّر دورها أولًا، وإلا يتوقف التراجع.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "users" WHERE "role" = 'CONTENT_UPLOADER') THEN
    RAISE EXCEPTION 'Reassign CONTENT_UPLOADER accounts before rolling back migration 0037';
  END IF;
  ALTER TABLE "users" DROP CONSTRAINT "users_role_check";
  ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('SUPER_ADMIN', 'CONFIRMER', 'TEACHER', 'ASSISTANT', 'STUDENT', 'PUBLIC', 'PARENT'));
END $$;
DROP TABLE IF EXISTS "course_staff";
ALTER TABLE "content" DROP COLUMN IF EXISTS "position";
