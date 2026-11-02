-- حجز طابور التأكيد (قرار المالك 2 نوفمبر 2026): موظف التأكيد يحجز دفعة من الطلبات (10 أو 20)
-- فتختفي من طابور زملائه حتى لا يتصل اثنان بالزبون نفسه. الحجز مؤقت: إن انتهت مدته عاد الطلب
-- إلى الطابور العام. إضافة فقط.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "reserved_by_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "reserved_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "reserved_until" timestamp with time zone;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_reserved_by_user_id_users_id_fk" FOREIGN KEY ("reserved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_reserved_idx" ON "orders" USING btree ("reserved_by_user_id","reserved_until");
