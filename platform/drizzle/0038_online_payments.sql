-- الدفع الإلكتروني عبر Guiddini/SATIM (قرار المالك 1 نوفمبر 2026). إضافة فقط.
--   1) طريقة دفع ONLINE للطلبات، ومصدر اشتراك ONLINE_PAYMENT (التفعيل فور تأكّد الخادم من الدفع).
--   2) online_payments: محاولة دفع لكل طلب، وحالتها كما تحقّق منها الخادم عند Guiddini.
DO $$ BEGIN
  ALTER TABLE "orders" DROP CONSTRAINT "orders_payment_check";
  ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_check" CHECK ("payment_method" IN ('COD', 'TRANSFER', 'FREE', 'ONLINE'));
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "course_enrollments" DROP CONSTRAINT "course_enrollments_source_check";
  ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_source_check" CHECK ("source" IN ('BOOK_ORDER', 'MANUAL', 'GIFT', 'CLAIM', 'CODE', 'ONLINE_PAYMENT'));
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "online_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text DEFAULT 'GUIDDINI' NOT NULL,
	"amount_dzd" integer NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"gateway_ref" text,
	"form_url" text,
	"gateway_status" text,
	"gateway_response" jsonb,
	"check_count" integer DEFAULT 0 NOT NULL,
	"checked_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "online_payments_status_check" CHECK ("online_payments"."status" IN ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'MISMATCH'))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "online_payments" ADD CONSTRAINT "online_payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "online_payments" ADD CONSTRAINT "online_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "online_payments_gateway_ref_unique" ON "online_payments" USING btree ("provider","gateway_ref");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "online_payments_pending_idx" ON "online_payments" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "online_payments_order_idx" ON "online_payments" USING btree ("order_id");
