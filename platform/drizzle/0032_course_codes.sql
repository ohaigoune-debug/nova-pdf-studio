-- أكواد تفعيل الدورة (دفعة لدورة بعينها، كل كود مرة واحدة) + نتيجة «أكّد هاتف حسابه» في سجلّ المكالمات.
-- إضافة فقط.
CREATE TABLE IF NOT EXISTS "course_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"batch_label" text,
	"code_hash" text NOT NULL,
	"code_prefix" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"expires_at" timestamp with time zone,
	"used_by_student_id" uuid,
	"used_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_codes_code_hash_unique" UNIQUE("code_hash"),
	CONSTRAINT "course_codes_status_check" CHECK ("course_codes"."status" IN ('ACTIVE', 'USED', 'DISABLED'))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "course_codes" ADD CONSTRAINT "course_codes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "course_codes" ADD CONSTRAINT "course_codes_used_by_student_id_students_id_fk" FOREIGN KEY ("used_by_student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "course_codes" ADD CONSTRAINT "course_codes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_codes_course_idx" ON "course_codes" USING btree ("course_id","batch_id");
--> statement-breakpoint
ALTER TABLE "call_events" DROP CONSTRAINT IF EXISTS "call_events_result_check";
--> statement-breakpoint
ALTER TABLE "call_events" ADD CONSTRAINT "call_events_result_check" CHECK ("call_events"."result" IN ('confirmed', 'already_confirmed', 'no_order', 'invalid_phone', 'disabled', 'phone_verified'));
