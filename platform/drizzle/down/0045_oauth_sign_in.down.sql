-- تراجع عن 0045_oauth_sign_in (يُفقد ربط الحسابات بـ Google وApple؛ الحسابات نفسها تبقى):
--   psql "$DATABASE_URL" -f drizzle/down/0045_oauth_sign_in.down.sql
-- ثم احذف سطرها من سجل الترحيلات، وإلا لن تُطبَّق من جديد عند إعادة نشر هذه النسخة:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1794500000000;
DROP TABLE IF EXISTS "oauth_tickets";
DROP TABLE IF EXISTS "oauth_identities";
