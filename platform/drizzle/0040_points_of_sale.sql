-- نقاط البيع (قرار المالك 2 نوفمبر 2026): مدارس ومكتبات شريكة تستلم باقات (كتب + دورة سنوية)،
-- وتولّد كود التفعيل لحظة بيع كل باقة من صفحة بسيطة على الهاتف. إضافة فقط.
--   1) دور POINT_OF_SALE لحسابات أصحاب نقاط البيع وموظفيهم (دخول بالهاتف وكلمة سر)،
--      ودور MANAGER لـ«مدير العمليات»: المدارس والمسوّقون والمخزون والأكواد والأموال المستلَمة،
--      بلا إعدادات تقنية ولا محتوى ولا أسعار ولا حسابات موظفين.
--   2) points_of_sale وأعضاؤها، وحركات مخزون الباقات لكل دورة، وما سدّدته كل نقطة.
--   3) course_codes: الكود المولَّد في نقطة بيع يُنسب إليها وإلى من ولّده، بسعره وعمولته وقت البيع،
--      ومختومًا (لا يُخزَّن صريحًا) ليُعاد عرضه لصاحب النقطة إن أضاعه التلميذ.
--   4) مصدر اشتراك POS.
DO $$ BEGIN
  ALTER TABLE "users" DROP CONSTRAINT "users_role_check";
  ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('SUPER_ADMIN', 'CONFIRMER', 'CONTENT_UPLOADER', 'MANAGER', 'POINT_OF_SALE', 'TEACHER', 'ASSISTANT', 'STUDENT', 'PUBLIC', 'PARENT'));
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "course_enrollments" DROP CONSTRAINT "course_enrollments_source_check";
  ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_source_check" CHECK ("source" IN ('BOOK_ORDER', 'MANUAL', 'GIFT', 'CLAIM', 'CODE', 'ONLINE_PAYMENT', 'POS'));
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "points_of_sale" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"wilaya_id" uuid,
	"address" text,
	"phone" text,
	"commission_dzd" integer DEFAULT 1000 NOT NULL,
	"low_stock_alert" integer DEFAULT 5 NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"listed" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "points_of_sale_status_check" CHECK ("points_of_sale"."status" IN ('ACTIVE', 'SUSPENDED')),
	CONSTRAINT "points_of_sale_commission_check" CHECK ("points_of_sale"."commission_dzd" >= 0),
	CONSTRAINT "points_of_sale_low_stock_check" CHECK ("points_of_sale"."low_stock_alert" >= 0)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "points_of_sale" ADD CONSTRAINT "points_of_sale_wilaya_id_wilayas_id_fk" FOREIGN KEY ("wilaya_id") REFERENCES "public"."wilayas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pos_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pos_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pos_members" ADD CONSTRAINT "pos_members_pos_id_points_of_sale_id_fk" FOREIGN KEY ("pos_id") REFERENCES "public"."points_of_sale"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pos_members" ADD CONSTRAINT "pos_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pos_members_user_unique" ON "pos_members" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pos_members_pos_idx" ON "pos_members" USING btree ("pos_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pos_stock_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pos_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"note" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pos_stock_moves_qty_check" CHECK ("pos_stock_moves"."qty" <> 0)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pos_stock_moves" ADD CONSTRAINT "pos_stock_moves_pos_id_points_of_sale_id_fk" FOREIGN KEY ("pos_id") REFERENCES "public"."points_of_sale"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pos_stock_moves" ADD CONSTRAINT "pos_stock_moves_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pos_stock_moves" ADD CONSTRAINT "pos_stock_moves_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pos_stock_moves_pos_idx" ON "pos_stock_moves" USING btree ("pos_id","course_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pos_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pos_id" uuid NOT NULL,
	"amount_dzd" integer NOT NULL,
	"note" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pos_payments_amount_check" CHECK ("pos_payments"."amount_dzd" > 0)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_pos_id_points_of_sale_id_fk" FOREIGN KEY ("pos_id") REFERENCES "public"."points_of_sale"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pos_payments_pos_idx" ON "pos_payments" USING btree ("pos_id","created_at");
--> statement-breakpoint
ALTER TABLE "course_codes" ADD COLUMN IF NOT EXISTS "pos_id" uuid;
--> statement-breakpoint
ALTER TABLE "course_codes" ADD COLUMN IF NOT EXISTS "code_sealed" text;
--> statement-breakpoint
ALTER TABLE "course_codes" ADD COLUMN IF NOT EXISTS "sale_price_dzd" integer;
--> statement-breakpoint
ALTER TABLE "course_codes" ADD COLUMN IF NOT EXISTS "commission_dzd" integer;
--> statement-breakpoint
ALTER TABLE "course_codes" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "course_codes" ADD CONSTRAINT "course_codes_pos_id_points_of_sale_id_fk" FOREIGN KEY ("pos_id") REFERENCES "public"."points_of_sale"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_codes_pos_idx" ON "course_codes" USING btree ("pos_id","created_at");
