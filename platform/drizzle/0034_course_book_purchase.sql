-- شراء «الدورة مع كتابها» مباشرة (قرار المالك 2026-10-24). إضافة فقط:
--  - courses.book_product_id: الكتاب المرفق بالدورة (سعره = سعر الدورة)، يُعبّأ للدورات الحالية من أرخص كتاب ورقي مرتبط منشور.
--  - order_items.course_id: الدورة المشتراة بالسطر، مثبَّتة وقت الشراء. الطلبات القديمة تبقى null (سلوكها كما كان).
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "book_product_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "courses" ADD CONSTRAINT "courses_book_product_id_products_id_fk" FOREIGN KEY ("book_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "course_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "order_items" ADD CONSTRAINT "order_items_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_course_idx" ON "order_items" USING btree ("course_id");
--> statement-breakpoint
UPDATE "courses" c SET "book_product_id" = (
  SELECT p.id FROM "course_products" cp JOIN "products" p ON p.id = cp.product_id
  WHERE cp.course_id = c.id AND p.deleted_at IS NULL AND p.status = 'PUBLISHED' AND p.type IN ('BOOK', 'PACK')
  ORDER BY p.price_dzd ASC, p.created_at ASC LIMIT 1
) WHERE c."book_product_id" IS NULL;
