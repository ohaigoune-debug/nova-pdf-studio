-- تبسيط المنصة (طلب المالك 1 نوفمبر 2026). إضافة فقط: لا حذف ولا تعديل لأي صف قائم.
--   1) دور «رافع محتوى» CONTENT_UPLOADER (توسيع قيد الدور كما في 0035).
--   2) course_staff: الدورات المسندة لكل رافع محتوى (لا يرى غيرها).
--   3) content.position: ترتيب يدوي لدروس الدورة (فارغ = الترتيب القديم من العنوان وتاريخ النشر).
DO $$ BEGIN
  ALTER TABLE "users" DROP CONSTRAINT "users_role_check";
  ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('SUPER_ADMIN', 'CONFIRMER', 'CONTENT_UPLOADER', 'TEACHER', 'ASSISTANT', 'STUDENT', 'PUBLIC', 'PARENT'));
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "course_staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "course_staff" ADD CONSTRAINT "course_staff_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "course_staff" ADD CONSTRAINT "course_staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "course_staff" ADD CONSTRAINT "course_staff_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_staff_unique" ON "course_staff" USING btree ("course_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_staff_user_idx" ON "course_staff" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN IF NOT EXISTS "position" integer;
