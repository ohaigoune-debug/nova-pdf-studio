-- تراجع عن 0044_class_posts_public (المنشورات العامة تصير منشورات «كل أفواجي» لتلاميذ أستاذها):
--   psql "$DATABASE_URL" -f drizzle/down/0044_class_posts_public.down.sql
-- ثم احذف سطرها من سجل الترحيلات، وإلا لن تُطبَّق من جديد عند إعادة نشر هذه النسخة:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1794400000000;
DROP INDEX IF EXISTS "class_posts_public_idx";
ALTER TABLE "class_posts" DROP COLUMN IF EXISTS "is_public";
