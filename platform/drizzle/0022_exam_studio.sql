-- MADRASADZ TEACHER EXAM STUDIO — كتل منظّمة في الورقة، تخطيط، مفضّلة، مراجعات، مكتبة الأستاذ
-- (إضافات فقط: توسيع قيد نوع العنصر، أعمدة بقيم افتراضية، جدولان جديدان؛ لا حذف ولا إعادة تسمية)
ALTER TABLE "exam_items" DROP CONSTRAINT IF EXISTS "exam_items_kind_check";
--> statement-breakpoint
ALTER TABLE "exam_items" ADD CONSTRAINT "exam_items_kind_check" CHECK ("exam_items"."kind" IN ('EXERCISE', 'QUESTION', 'TEXT', 'PAGE_BREAK', 'BLOCK'));
--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "layout" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "is_favorite" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE "exam_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"reason" text DEFAULT 'AUTO' NOT NULL,
	"label" text,
	"snapshot" jsonb NOT NULL,
	"items_count" integer DEFAULT 0 NOT NULL,
	"total_points" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_revisions_reason_check" CHECK ("exam_revisions"."reason" IN ('AUTO', 'MANUAL', 'RESTORE'))
);
--> statement-breakpoint
CREATE TABLE "teacher_library_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"kind" text DEFAULT 'BLOCK' NOT NULL,
	"title" text NOT NULL,
	"subject_id" uuid,
	"level_id" uuid,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "teacher_library_items_kind_check" CHECK ("teacher_library_items"."kind" IN ('BLOCK', 'HEADER'))
);
--> statement-breakpoint
ALTER TABLE "exam_revisions" ADD CONSTRAINT "exam_revisions_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "exam_revisions" ADD CONSTRAINT "exam_revisions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "teacher_library_items" ADD CONSTRAINT "teacher_library_items_workspace_id_teacher_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."teacher_workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "teacher_library_items" ADD CONSTRAINT "teacher_library_items_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "teacher_library_items" ADD CONSTRAINT "teacher_library_items_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "teacher_library_items" ADD CONSTRAINT "teacher_library_items_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "exam_revisions_exam_idx" ON "exam_revisions" USING btree ("exam_id","number");
--> statement-breakpoint
CREATE INDEX "teacher_library_items_ws_idx" ON "teacher_library_items" USING btree ("workspace_id","kind","updated_at");
--> statement-breakpoint
CREATE INDEX "exams_favorite_idx" ON "exams" USING btree ("workspace_id","is_favorite");
