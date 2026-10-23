-- تراجع عن 0027_academy (بعد نسخة احتياطية): psql "$DATABASE_URL" -f drizzle/down/0027_academy.down.sql
BEGIN;
DROP TABLE IF EXISTS "support_messages", "support_tickets", "delivery_events", "otp_codes", "live_sessions", "course_claims", "course_enrollments", "course_products", "courses";
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_stream_id_streams_id_fk";
DROP INDEX IF EXISTS "orders_tracking_idx";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "otp_verified_at", DROP COLUMN IF EXISTS "stream_id", DROP COLUMN IF EXISTS "beneficiary_student_id", DROP COLUMN IF EXISTS "delivery_provider", DROP COLUMN IF EXISTS "delivery_tracking_id";
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_max_per_order_check";
ALTER TABLE "products" DROP COLUMN IF EXISTS "requires_stream", DROP COLUMN IF EXISTS "max_per_order";
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "phone_verified_at";
COMMIT;
