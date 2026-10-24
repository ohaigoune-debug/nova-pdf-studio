-- يُعاد الطلب ذو حالة جديدة إلى أقرب حالة قديمة قبل تضييق القيد
UPDATE "orders" SET "status" = 'PENDING' WHERE "status" IN ('NO_ANSWER', 'CALL_LATER');
UPDATE "orders" SET "status" = 'CANCELLED' WHERE "status" = 'RETURNED';
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_status_check";
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_check" CHECK ("orders"."status" IN ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'));
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_delivery_type_check";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "returned_at";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "last_call_at";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "confirm_attempts";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "delivery_type";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "commune";
UPDATE "delivery_events" SET "status" = 'IN_TRANSIT' WHERE "status" = 'FAILED_ATTEMPT';
ALTER TABLE "delivery_events" DROP CONSTRAINT IF EXISTS "delivery_events_status_check";
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_status_check" CHECK ("delivery_events"."status" IN ('CREATED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED', 'CANCELLED', 'UNKNOWN'));
UPDATE "course_enrollments" SET "source" = 'MANUAL' WHERE "source" = 'CODE';
ALTER TABLE "course_enrollments" DROP CONSTRAINT IF EXISTS "course_enrollments_source_check";
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_source_check" CHECK ("course_enrollments"."source" IN ('BOOK_ORDER', 'MANUAL', 'GIFT', 'CLAIM'));
DROP TABLE IF EXISTS "call_events";
ALTER TABLE "otp_codes" DROP COLUMN IF EXISTS "provider_ref";
