DROP INDEX IF EXISTS "order_items_course_idx";
ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_course_id_courses_id_fk";
ALTER TABLE "order_items" DROP COLUMN IF EXISTS "course_id";
ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "courses_book_product_id_products_id_fk";
ALTER TABLE "courses" DROP COLUMN IF EXISTS "book_product_id";
