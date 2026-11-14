-- «الأستاذ المساعد» في القسم الافتراضي (قرار المالك، 13-14 نوفمبر 2026): نطاق للمساعد.
-- إضافة فقط: المساعدون والأكواد القائمة يبقون مساعدي حضور (scope = 'FULL') كما كانوا.
ALTER TABLE "assistant_codes" ADD COLUMN IF NOT EXISTS "scope" text DEFAULT 'FULL' NOT NULL;
--> statement-breakpoint
ALTER TABLE "teacher_assistants" ADD COLUMN IF NOT EXISTS "scope" text DEFAULT 'FULL' NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "assistant_codes" ADD CONSTRAINT "assistant_codes_scope_check" CHECK ("assistant_codes"."scope" in ('FULL', 'CLASSROOM'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "teacher_assistants" ADD CONSTRAINT "teacher_assistants_scope_check" CHECK ("teacher_assistants"."scope" in ('FULL', 'CLASSROOM'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
-- مراجعة تعليقات القسم الافتراضي (قرار المالك، 14 نوفمبر 2026): تعليق التلميذ ينتظر اعتماد الأستاذ أو مساعده.
-- التعليقات القائمة تبقى ظاهرة (APPROVED).
ALTER TABLE "class_comments" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'APPROVED' NOT NULL;
--> statement-breakpoint
ALTER TABLE "class_comments" ADD COLUMN IF NOT EXISTS "reviewed_by_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "class_comments" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "class_comments" ADD CONSTRAINT "class_comments_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "class_comments" ADD CONSTRAINT "class_comments_status_check" CHECK ("class_comments"."status" in ('PENDING', 'APPROVED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "class_comments_post_status_idx" ON "class_comments" USING btree ("post_id","status");
