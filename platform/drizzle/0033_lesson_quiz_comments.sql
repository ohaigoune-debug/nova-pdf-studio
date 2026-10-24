-- تحت فيديو الحصة: اختبار QCM مرتبط + تعليقات بموافقة الأستاذ (قرار المالك 2026-10-24). إضافة فقط.
CREATE TABLE IF NOT EXISTS "lesson_quizzes" (
	"content_id" uuid PRIMARY KEY NOT NULL,
	"quiz_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lesson_quizzes" ADD CONSTRAINT "lesson_quizzes_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lesson_quizzes" ADD CONSTRAINT "lesson_quizzes_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lesson_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"reply" text,
	"moderated_by_user_id" uuid,
	"moderated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_comments_status_check" CHECK ("lesson_comments"."status" IN ('PENDING', 'APPROVED', 'REJECTED'))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lesson_comments" ADD CONSTRAINT "lesson_comments_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lesson_comments" ADD CONSTRAINT "lesson_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lesson_comments" ADD CONSTRAINT "lesson_comments_moderated_by_user_id_users_id_fk" FOREIGN KEY ("moderated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_comments_content_idx" ON "lesson_comments" USING btree ("content_id","status","created_at");
