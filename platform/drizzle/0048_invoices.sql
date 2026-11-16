-- الفواتير (قرار المالك 16 نوفمبر 2026): فاتورة لكل تلميذ، تلقائيًا عند تسليم الطلب ويدويًا من الإدارة.
-- إضافة فقط: جدولان جديدان، لا تغيير في أي جدول قائم. الفواتير القديمة تُصدر من زرّ «أصدر الفواتير الناقصة».
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"year" integer NOT NULL,
	"seq" integer NOT NULL,
	"source" text NOT NULL,
	"order_id" uuid,
	"user_id" uuid,
	"student_id" uuid,
	"customer_name" text NOT NULL,
	"customer_phone" text,
	"student_code" text,
	"lines" jsonb NOT NULL,
	"subtotal_dzd" integer NOT NULL,
	"shipping_dzd" integer DEFAULT 0 NOT NULL,
	"discount_dzd" integer DEFAULT 0 NOT NULL,
	"total_dzd" integer NOT NULL,
	"payment_method" text NOT NULL,
	"payment_ref" text,
	"payment_receipt_url" text,
	"seller" jsonb NOT NULL,
	"note" text,
	"status" text DEFAULT 'ISSUED' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number"),
	CONSTRAINT "invoices_status_check" CHECK ("invoices"."status" IN ('ISSUED', 'CANCELLED')),
	CONSTRAINT "invoices_source_check" CHECK ("invoices"."source" IN ('ORDER', 'MANUAL')),
	CONSTRAINT "invoices_payment_check" CHECK ("invoices"."payment_method" IN ('COD', 'TRANSFER', 'FREE', 'ONLINE', 'CASH', 'POS', 'OTHER')),
	CONSTRAINT "invoices_amounts_check" CHECK ("invoices"."subtotal_dzd" >= 0 AND "invoices"."shipping_dzd" >= 0 AND "invoices"."discount_dzd" >= 0 AND "invoices"."total_dzd" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_counters" (
	"year" integer PRIMARY KEY NOT NULL,
	"last" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_year_seq_unique" ON "invoices" USING btree ("year","seq");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_order_unique" ON "invoices" USING btree ("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_user_idx" ON "invoices" USING btree ("user_id","issued_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_student_idx" ON "invoices" USING btree ("student_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_issued_idx" ON "invoices" USING btree ("issued_at");
