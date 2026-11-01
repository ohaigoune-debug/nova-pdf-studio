-- تراجع عن 0038_online_payments. بعد نسخة احتياطية فقط:
--   psql "$DATABASE_URL" -f drizzle/down/0038_online_payments.down.sql
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1793800000000;
-- يتوقف إن وُجدت طلبات أو اشتراكات بالدفع الإلكتروني (سجلّ مالي لا يُحذف آليًّا).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "orders" WHERE "payment_method" = 'ONLINE') OR EXISTS (SELECT 1 FROM "course_enrollments" WHERE "source" = 'ONLINE_PAYMENT') THEN
    RAISE EXCEPTION 'Online payments exist: keep migration 0038';
  END IF;
  ALTER TABLE "orders" DROP CONSTRAINT "orders_payment_check";
  ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_check" CHECK ("payment_method" IN ('COD', 'TRANSFER', 'FREE'));
  ALTER TABLE "course_enrollments" DROP CONSTRAINT "course_enrollments_source_check";
  ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_source_check" CHECK ("source" IN ('BOOK_ORDER', 'MANUAL', 'GIFT', 'CLAIM', 'CODE'));
END $$;
DROP TABLE IF EXISTS "online_payments";
