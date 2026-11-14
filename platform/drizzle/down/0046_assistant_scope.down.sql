-- تراجع عن 0046_assistant_scope (كل المساعدين يعودون مساعدي حضور، ويُلغى «الأستاذ المساعد»):
--   psql "$DATABASE_URL" -f drizzle/down/0046_assistant_scope.down.sql
-- ثم احذف سطرها من سجل الترحيلات، وإلا لن تُطبَّق من جديد عند إعادة نشر هذه النسخة:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1794600000000;
-- تنبيه: قبل التراجع ألغِ عضويات «الأستاذ المساعد» من صفحة المساعدين، وإلا صار أصحابها مساعدي حضور.
ALTER TABLE "teacher_assistants" DROP CONSTRAINT IF EXISTS "teacher_assistants_scope_check";
ALTER TABLE "assistant_codes" DROP CONSTRAINT IF EXISTS "assistant_codes_scope_check";
ALTER TABLE "teacher_assistants" DROP COLUMN IF EXISTS "scope";
ALTER TABLE "assistant_codes" DROP COLUMN IF EXISTS "scope";
