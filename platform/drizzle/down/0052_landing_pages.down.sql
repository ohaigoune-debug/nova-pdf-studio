-- تراجع عن 0052_landing_pages (تُحذف صفحات الهبوط وإحصاءاتها، وتبقى الطلبات دون نسبة لمصدرها):
--   psql "$DATABASE_URL" -f drizzle/down/0052_landing_pages.down.sql
-- ثم احذف سطرها من سجل الترحيلات، وإلا لن تُطبَّق من جديد عند إعادة نشر هذه النسخة:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1795100000000;
DROP INDEX IF EXISTS "orders_landing_idx";
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_landing_id_landing_pages_id_fk";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "traffic_source";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "landing_id";
DROP TABLE IF EXISTS "landing_visits";
DROP TABLE IF EXISTS "landing_pages";
