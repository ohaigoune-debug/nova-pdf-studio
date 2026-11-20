-- تراجع عن 0051_support_ai (أوقف المساعد من الإدارة أولًا):
--   psql "$DATABASE_URL" -f drizzle/down/0051_support_ai.down.sql
-- ثم احذف سطرها من سجل الترحيلات، وإلا لن تُطبَّق من جديد عند إعادة نشر هذه النسخة:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1795100000000;
ALTER TABLE "support_tickets" DROP COLUMN IF EXISTS "ai_paused";
ALTER TABLE "support_messages" DROP COLUMN IF EXISTS "is_ai";
