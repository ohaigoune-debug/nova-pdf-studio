-- تراجع عن 0019_store: يزيل جداول المتجر (المنتجات، ملفاتها، الطلبات، سطورها، التنزيلات). الملفات نفسها في files تبقى.
-- الاستعمال (بعد نسخة احتياطية): psql "$DATABASE_URL" -f drizzle/down/0019_store.down.sql
-- ثم احذف سطر 0019 من drizzle.__drizzle_migrations إن أردت إعادة تطبيقها لاحقاً.
BEGIN;
DROP TABLE IF EXISTS "downloads";
DROP TABLE IF EXISTS "order_items";
DROP TABLE IF EXISTS "orders";
DROP TABLE IF EXISTS "product_files";
DROP TABLE IF EXISTS "products";
COMMIT;
