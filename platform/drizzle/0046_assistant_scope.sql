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
