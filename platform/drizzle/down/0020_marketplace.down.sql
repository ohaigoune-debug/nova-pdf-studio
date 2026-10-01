-- تراجع عن 0020_marketplace: يزيل جداول السوق فقط؛ المنتجات والطلبات في المتجر تبقى (product_id في العروض يُفكّ تلقائياً).
-- الاستعمال (بعد نسخة احتياطية): psql "$DATABASE_URL" -f drizzle/down/0020_marketplace.down.sql
-- ثم احذف سطر 0020 من drizzle.__drizzle_migrations إن أردت إعادة تطبيقها لاحقاً.
BEGIN;
DROP TABLE IF EXISTS "teacher_payouts";
DROP TABLE IF EXISTS "listing_purchases";
DROP TABLE IF EXISTS "listings";
COMMIT;
