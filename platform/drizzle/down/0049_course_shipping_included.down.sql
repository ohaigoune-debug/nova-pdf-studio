-- تراجع عن 0049_course_shipping_included (كل الدورات تعود «السعر لا يشمل التوصيل»):
--   psql "$DATABASE_URL" -f drizzle/down/0049_course_shipping_included.down.sql
-- ثم احذف سطرها من سجل الترحيلات، وإلا لن تُطبَّق من جديد عند إعادة نشر هذه النسخة:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1794700000000;
ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "courses_shipping_included_check";
ALTER TABLE "courses" DROP COLUMN IF EXISTS "shipping_included";
