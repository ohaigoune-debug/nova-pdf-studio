-- النسخة الرقمية للدورة (قرار المالك 2 نوفمبر 2026): بطاقة مستقلة في الكتالوج تفتح الدورة نفسها
-- بالدفع بالبطاقة فقط، دون كتاب ولا توصيل. إضافة فقط.
--   1) courses.digital_price_dzd: سعر الدورة دون كتاب (null = لا نسخة رقمية). 50 دج على الأقل (حدّ eFawtara).
--   2) order_items.product_id يقبل null: سطر «الدورة الرقمية» لا منتج له (الدورة في course_id).
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "digital_price_dzd" integer;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "courses" ADD CONSTRAINT "courses_digital_price_check" CHECK ("courses"."digital_price_dzd" IS NULL OR "courses"."digital_price_dzd" >= 50);
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "product_id" DROP NOT NULL;
