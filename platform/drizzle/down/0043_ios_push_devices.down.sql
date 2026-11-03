-- تراجع عن 0043_ios_push_devices (رموز أجهزة فقط، تُسجَّل من جديد عند فتح التطبيق):
--   psql "$DATABASE_URL" -f drizzle/down/0043_ios_push_devices.down.sql
-- ثم احذف سطرها من سجل الترحيلات، وإلا لن تُطبَّق من جديد عند إعادة نشر هذه النسخة:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1794300000000;
DROP TABLE IF EXISTS "ios_push_devices";
