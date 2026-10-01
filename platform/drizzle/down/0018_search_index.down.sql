-- تراجع عن 0018_search_index: يزيل عمود البحث المولَّد وفهرسه فقط.
-- الاستعمال (بعد نسخة احتياطية): psql "$DATABASE_URL" -f drizzle/down/0018_search_index.down.sql
-- ثم احذف سطر 0018 من drizzle.__drizzle_migrations إن أردت إعادة تطبيقها لاحقاً.
BEGIN;
DROP INDEX IF EXISTS "resources_search_idx";
ALTER TABLE "resources" DROP COLUMN IF EXISTS "search";
COMMIT;
