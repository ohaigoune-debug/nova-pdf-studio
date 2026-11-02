-- تراجع عن 0040_points_of_sale. بعد نسخة احتياطية فقط:
--   psql "$DATABASE_URL" -f drizzle/down/0040_points_of_sale.down.sql
-- ثم احذف سطرها من سجل الترحيلات، وإلا لن تُطبَّق من جديد عند إعادة نشر هذه النسخة:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1794000000000;
-- يتوقف إن وُجدت أكواد مولَّدة في نقاط البيع أو حسابات لها أو اشتراكات مصدرها POS (سجلّ مالي لا يُحذف آليًّا).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "course_codes" WHERE "pos_id" IS NOT NULL)
     OR EXISTS (SELECT 1 FROM "users" WHERE "role" = 'POINT_OF_SALE')
     OR EXISTS (SELECT 1 FROM "course_enrollments" WHERE "source" = 'POS') THEN
    RAISE EXCEPTION 'Points of sale data exists: keep migration 0040';
  END IF;
  ALTER TABLE "course_codes" DROP CONSTRAINT IF EXISTS "course_codes_pos_id_points_of_sale_id_fk";
  DROP INDEX IF EXISTS "course_codes_pos_idx";
  ALTER TABLE "course_codes" DROP COLUMN IF EXISTS "pos_id";
  ALTER TABLE "course_codes" DROP COLUMN IF EXISTS "code_sealed";
  ALTER TABLE "course_codes" DROP COLUMN IF EXISTS "sale_price_dzd";
  ALTER TABLE "course_codes" DROP COLUMN IF EXISTS "commission_dzd";
  ALTER TABLE "course_codes" DROP COLUMN IF EXISTS "cancelled_at";
  DROP TABLE IF EXISTS "pos_payments";
  DROP TABLE IF EXISTS "pos_stock_moves";
  DROP TABLE IF EXISTS "pos_members";
  DROP TABLE IF EXISTS "points_of_sale";
  ALTER TABLE "course_enrollments" DROP CONSTRAINT "course_enrollments_source_check";
  ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_source_check" CHECK ("source" IN ('BOOK_ORDER', 'MANUAL', 'GIFT', 'CLAIM', 'CODE', 'ONLINE_PAYMENT'));
  ALTER TABLE "users" DROP CONSTRAINT "users_role_check";
  ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('SUPER_ADMIN', 'CONFIRMER', 'CONTENT_UPLOADER', 'TEACHER', 'ASSISTANT', 'STUDENT', 'PUBLIC', 'PARENT'));
END $$;
