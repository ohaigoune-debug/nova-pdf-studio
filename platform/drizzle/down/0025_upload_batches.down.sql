-- تراجع عن 0025_upload_batches (بعد نسخة احتياطية): psql "$DATABASE_URL" -f drizzle/down/0025_upload_batches.down.sql
BEGIN;
DROP TABLE IF EXISTS "upload_batches";
COMMIT;
