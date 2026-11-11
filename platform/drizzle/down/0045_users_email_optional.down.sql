-- تراجع عن 0045_users_email_optional:
--   psql "$DATABASE_URL" -f drizzle/down/0045_users_email_optional.down.sql
-- ثم احذف سطرها من سجل الترحيلات، وإلا لن تُطبَّق من جديد عند إعادة نشر هذه النسخة:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1794500000000;
-- تنبيه: يفشل هذا التراجع ما دام في الجدول حساب بلا بريد (سُجّل بالهاتف وحده). لا تُكتب له عناوين وهمية:
-- عالج تلك الحسابات يدويًا أولًا (SELECT id FROM users WHERE email IS NULL) ثم أعد التشغيل.
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;
