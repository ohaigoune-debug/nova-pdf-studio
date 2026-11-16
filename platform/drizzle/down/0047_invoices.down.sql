-- تراجع عن 0047_invoices (تُحذف كل الفواتير وعدّاداتها — احفظ نسخة منها أولًا إن كانت صدرت فواتير حقيقية):
--   psql "$DATABASE_URL" -f drizzle/down/0047_invoices.down.sql
-- ثم احذف سطرها من سجل الترحيلات، وإلا لن تُطبَّق من جديد عند إعادة نشر هذه النسخة:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1794700000000;
DROP TABLE IF EXISTS "invoices";
DROP TABLE IF EXISTS "invoice_counters";
