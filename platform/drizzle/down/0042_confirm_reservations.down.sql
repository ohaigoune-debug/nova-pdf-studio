-- تراجع عن 0042_confirm_reservations (حجوزات مؤقتة فقط، لا سجلّ مالي):
--   psql "$DATABASE_URL" -f drizzle/down/0042_confirm_reservations.down.sql
-- ثم احذف سطرها من سجل الترحيلات، وإلا لن تُطبَّق من جديد عند إعادة نشر هذه النسخة:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1794200000000;
DO $$ BEGIN
  DROP INDEX IF EXISTS "orders_reserved_idx";
  ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_reserved_by_user_id_users_id_fk";
  ALTER TABLE "orders" DROP COLUMN IF EXISTS "reserved_until";
  ALTER TABLE "orders" DROP COLUMN IF EXISTS "reserved_at";
  ALTER TABLE "orders" DROP COLUMN IF EXISTS "reserved_by_user_id";
  DELETE FROM "settings" WHERE "key" = 'confirm.reservations';
END $$;
