-- Exam Builder — المرحلة 6 (ورشة الأستاذ): قوالب، ربط بفوج، وتتبّع الطباعة — أعمدة إضافية فقط
ALTER TABLE "exams" ADD COLUMN "is_template" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "print_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "last_printed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exams_template_idx" ON "exams" USING btree ("workspace_id","is_template");--> statement-breakpoint
CREATE INDEX "exams_group_idx" ON "exams" USING btree ("group_id");
