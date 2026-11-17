-- تراجع عن 0052_temp_login_code (الحسابات ذات الرمز المؤقت تبقى تدخل به كأنه كلمة سر عادية):
--   psql "$DATABASE_URL" -f drizzle/down/0052_temp_login_code.down.sql
-- ثم احذف سطرها من سجل الترحيلات، وإلا لن تُطبَّق من جديد عند إعادة نشر هذه النسخة:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1795200000000;
DROP INDEX IF EXISTS "users_temp_password_idx";
ALTER TABLE "users" DROP COLUMN IF EXISTS "temp_reminders";
ALTER TABLE "users" DROP COLUMN IF EXISTS "temp_code_sealed";
ALTER TABLE "users" DROP COLUMN IF EXISTS "temp_password_until";
