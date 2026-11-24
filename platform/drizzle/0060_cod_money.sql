-- أين مال الدفع عند الاستلام؟ (قرار المالك 24 نوفمبر 2026): حالة المال لكل طلب مسلَّم، من EcoTrack أو بتعليم المشرف.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cod_money_status" text;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cod_money_checked_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cod_received_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cod_received_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cod_fee_dzd" integer;
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_cod_money_check";
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cod_money_check" CHECK ("cod_money_status" IS NULL OR "cod_money_status" IN ('WITH_DRIVER', 'AT_CARRIER', 'READY', 'RECEIVED'));
--> statement-breakpoint
-- الطلبات المسلَّمة قبل أكثر من 90 يومًا: يُفترض أنّ مالها وصل (لا تُستطلع)
UPDATE "orders" SET "cod_money_status" = 'RECEIVED', "cod_received_at" = "delivered_at"
WHERE "status" = 'DELIVERED' AND "payment_method" = 'COD' AND "cod_money_status" IS NULL AND "delivered_at" < now() - interval '90 days';
