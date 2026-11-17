-- أرقام ممنوعة من الدفع عند الاستلام (قرار المالك، 17 نوفمبر 2026): من أرجع طلبًا بلا سبب ولو مرة
-- يدفع بالبطاقة فقط. NOVA = مستوردة من متجر نوفا، ADMIN = أضافها المشرف، MADRASA = سطر إعفاء لرقم
-- حُظر بمرتجعات مدرسة نفسها (هذه تُحسب من جدول الطلبات مباشرة ولا تُخزَّن هنا).
-- lifted_at = أعفاه المشرف؛ مرتجع جديد بلا سبب بعد الإعفاء يحظره من جديد.
-- إضافة فقط: لا يمسّ أي جدول قائم.
CREATE TABLE IF NOT EXISTS "cod_phone_blocks" (
	"phone" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"returns" integer DEFAULT 0 NOT NULL,
	"last_return_at" timestamp with time zone,
	"note" text,
	"lifted_at" timestamp with time zone,
	"lifted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cod_phone_blocks_source_check" CHECK ("cod_phone_blocks"."source" in ('NOVA', 'ADMIN', 'MADRASA')),
	CONSTRAINT "cod_phone_blocks_phone_check" CHECK ("cod_phone_blocks"."phone" ~ '^0[5-7][0-9]{8}$'),
	CONSTRAINT "cod_phone_blocks_returns_check" CHECK ("cod_phone_blocks"."returns" >= 0)
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "cod_phone_blocks" ADD CONSTRAINT "cod_phone_blocks_lifted_by_users_id_fk" FOREIGN KEY ("lifted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
-- مرتجعات مدرسة تُفحص برقم الهاتف عند كل طلب بالدفع عند الاستلام
CREATE INDEX IF NOT EXISTS "orders_phone_status_idx" ON "orders" USING btree ("phone", "status");
