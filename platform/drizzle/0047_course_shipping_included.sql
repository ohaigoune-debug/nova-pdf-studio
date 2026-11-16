-- التوصيل في سعر الدورة مع كتابها (قرار المالك، 16 نوفمبر 2026)، لكل دورة:
--   NONE = السعر لا يشمل التوصيل (الحال الحالي: يدفع التلميذ رسم التوصيل كاملًا)
--   DESK = شامل التوصيل إلى مكتب شركة التوصيل (من يختار المنزل يدفع الفرق فقط)
--   HOME = شامل التوصيل إلى المنزل (لا رسم توصيل أبدًا)
-- إضافة فقط: الدورات القائمة تبقى «لا يشمل» فلا يتغيّر أي سعر بعد النشر.
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "shipping_included" text DEFAULT 'NONE' NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "courses" ADD CONSTRAINT "courses_shipping_included_check" CHECK ("courses"."shipping_included" in ('NONE', 'DESK', 'HOME'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
