-- تراجع عن 0046_assistant_scope (كل المساعدين يعودون مساعدي حضور، ويُلغى «الأستاذ المساعد»،
-- وتظهر كل التعليقات المنتظِرة للجميع):
--   psql "$DATABASE_URL" -f drizzle/down/0046_assistant_scope.down.sql
-- ثم احذف سطرها من سجل الترحيلات، وإلا لن تُطبَّق من جديد عند إعادة نشر هذه النسخة:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1794600000000;
-- تنبيه: قبل التراجع ألغِ عضويات «الأستاذ المساعد» من صفحة المساعدين، وإلا صار أصحابها مساعدي حضور.
ALTER TABLE "teacher_assistants" DROP CONSTRAINT IF EXISTS "teacher_assistants_scope_check";
ALTER TABLE "assistant_codes" DROP CONSTRAINT IF EXISTS "assistant_codes_scope_check";
ALTER TABLE "teacher_assistants" DROP COLUMN IF EXISTS "scope";
ALTER TABLE "assistant_codes" DROP COLUMN IF EXISTS "scope";
DROP INDEX IF EXISTS "class_comments_post_status_idx";
ALTER TABLE "class_comments" DROP CONSTRAINT IF EXISTS "class_comments_status_check";
ALTER TABLE "class_comments" DROP CONSTRAINT IF EXISTS "class_comments_reviewed_by_user_id_users_id_fk";
ALTER TABLE "class_comments" DROP COLUMN IF EXISTS "reviewed_at";
ALTER TABLE "class_comments" DROP COLUMN IF EXISTS "reviewed_by_user_id";
ALTER TABLE "class_comments" DROP COLUMN IF EXISTS "status";
