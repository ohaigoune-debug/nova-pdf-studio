-- المتجر على نسق NOVA COMMERCE: حالات تأكيد هاتفي (لا يردّ / اتصل لاحقاً) وحالة «مرتجع»،
-- حقول البلدية ونوع التسليم ومحاولات التأكيد، سجلّ المكالمات الواردة، ومصدر تفعيل «CODE» (كود مطبوع في الكتاب).
-- إضافة فقط: لا يُحذف صف ولا يتغيّر معنى قيمة قائمة.
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_status_check";
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_check" CHECK ("orders"."status" IN ('PENDING', 'NO_ANSWER', 'CALL_LATER', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED'));
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "commune" text;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_type" text DEFAULT 'HOME' NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "confirm_attempts" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "last_call_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "returned_at" timestamp with time zone;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_type_check" CHECK ("orders"."delivery_type" IN ('HOME', 'DESK'));
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
ALTER TABLE "delivery_events" DROP CONSTRAINT IF EXISTS "delivery_events_status_check";
--> statement-breakpoint
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_status_check" CHECK ("delivery_events"."status" IN ('CREATED', 'IN_TRANSIT', 'FAILED_ATTEMPT', 'DELIVERED', 'RETURNED', 'CANCELLED', 'UNKNOWN'));
--> statement-breakpoint
ALTER TABLE "course_enrollments" DROP CONSTRAINT IF EXISTS "course_enrollments_source_check";
--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_source_check" CHECK ("course_enrollments"."source" IN ('BOOK_ORDER', 'MANUAL', 'GIFT', 'CLAIM', 'CODE'));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "call_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"order_id" uuid,
	"order_number" text,
	"result" text NOT NULL,
	"channel" text DEFAULT 'call' NOT NULL,
	"text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "call_events_result_check" CHECK ("call_events"."result" IN ('confirmed', 'already_confirmed', 'no_order', 'invalid_phone', 'disabled'))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "call_events" ADD CONSTRAINT "call_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_events_phone_idx" ON "call_events" USING btree ("phone","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_events_created_idx" ON "call_events" USING btree ("created_at");

--> statement-breakpoint
ALTER TABLE "otp_codes" ADD COLUMN IF NOT EXISTS "provider_ref" text;
