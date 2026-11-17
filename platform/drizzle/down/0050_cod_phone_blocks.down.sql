-- تراجع عن 0050_cod_phone_blocks (يعود الدفع عند الاستلام متاحًا لكل الأرقام):
--   psql "$DATABASE_URL" -f drizzle/down/0050_cod_phone_blocks.down.sql
-- ثم احذف سطرها من سجل الترحيلات، وإلا لن تُطبَّق من جديد عند إعادة نشر هذه النسخة:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1795000000000;
DROP INDEX IF EXISTS "orders_phone_status_idx";
DROP TABLE IF EXISTS "cod_phone_blocks";
