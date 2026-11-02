-- تراجع عن 0039_course_digital_offer. بعد نسخة احتياطية فقط:
--   psql "$DATABASE_URL" -f drizzle/down/0039_course_digital_offer.down.sql
-- ثم احذف سطرها من سجل الترحيلات، وإلا لن تُطبَّق من جديد عند إعادة نشر هذه النسخة:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1793900000000;
-- يتوقف إن وُجدت طلبات رقمية (أسطر بلا منتج): سجلّ مالي لا يُحذف آليًّا.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "order_items" WHERE "product_id" IS NULL) THEN
    RAISE EXCEPTION 'Digital course orders exist: keep migration 0039';
  END IF;
  ALTER TABLE "order_items" ALTER COLUMN "product_id" SET NOT NULL;
  ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "courses_digital_price_check";
  ALTER TABLE "courses" DROP COLUMN IF EXISTS "digital_price_dzd";
END $$;
