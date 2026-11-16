-- طلب تغيير المستوى/الشعبة (قرار المالك 16 نوفمبر 2026): يراجعه عون التأكيد ويؤكده. إضافة فقط: جدول جديد.
CREATE TABLE IF NOT EXISTS "scope_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"from_level_id" uuid,
	"from_stream_id" uuid,
	"to_level_id" uuid NOT NULL,
	"to_stream_id" uuid,
	"reason" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scope_change_requests_status_check" CHECK ("scope_change_requests"."status" IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "scope_change_requests" ADD CONSTRAINT "scope_change_requests_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "scope_change_requests" ADD CONSTRAINT "scope_change_requests_from_level_id_levels_id_fk" FOREIGN KEY ("from_level_id") REFERENCES "public"."levels"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "scope_change_requests" ADD CONSTRAINT "scope_change_requests_from_stream_id_streams_id_fk" FOREIGN KEY ("from_stream_id") REFERENCES "public"."streams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "scope_change_requests" ADD CONSTRAINT "scope_change_requests_to_level_id_levels_id_fk" FOREIGN KEY ("to_level_id") REFERENCES "public"."levels"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "scope_change_requests" ADD CONSTRAINT "scope_change_requests_to_stream_id_streams_id_fk" FOREIGN KEY ("to_stream_id") REFERENCES "public"."streams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "scope_change_requests" ADD CONSTRAINT "scope_change_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scope_change_requests_one_pending" ON "scope_change_requests" USING btree ("student_id") WHERE "scope_change_requests"."status" = 'PENDING';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scope_change_requests_status_idx" ON "scope_change_requests" USING btree ("status","created_at");
