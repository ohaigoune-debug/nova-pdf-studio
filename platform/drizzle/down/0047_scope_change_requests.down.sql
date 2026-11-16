-- تراجع عن 0047_scope_change_requests (تُحذف طلبات تغيير الشعبة؛ مستوى التلاميذ وشعبهم في حساباتهم لا تُمسّ):
--   psql "$DATABASE_URL" -f drizzle/down/0047_scope_change_requests.down.sql
-- ثم احذف سطرها من سجل الترحيلات، وإلا لن تُطبَّق من جديد عند إعادة نشر هذه النسخة:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1794700000000;
DROP TABLE IF EXISTS "scope_change_requests";
