-- Exam Builder — المرحلة 2: ورقة الامتحان وعناصرها (جداول إضافية فقط)
CREATE TABLE "exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'TEST' NOT NULL,
	"subject_id" uuid,
	"level_id" uuid,
	"stream_id" uuid,
	"school_term" integer,
	"academic_year" text,
	"duration_minutes" integer DEFAULT 120 NOT NULL,
	"target_points" numeric(6, 2) DEFAULT '20' NOT NULL,
	"total_points" numeric(8, 2) DEFAULT '0' NOT NULL,
	"instructions" text,
	"header" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"difficulty_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"source_exam_id" uuid,
	"pdf_file_id" uuid,
	"solution_pdf_file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "exams_kind_check" CHECK ("exams"."kind" IN ('TEST', 'HOMEWORK', 'BAC_MOCK', 'BEM_MOCK', 'QUIZ', 'PRACTICE')),
	CONSTRAINT "exams_status_check" CHECK ("exams"."status" IN ('DRAFT', 'READY', 'ARCHIVED')),
	CONSTRAINT "exams_term_check" CHECK ("exams"."school_term" IS NULL OR "exams"."school_term" BETWEEN 1 AND 3),
	CONSTRAINT "exams_duration_check" CHECK ("exams"."duration_minutes" BETWEEN 5 AND 600)
);
--> statement-breakpoint
CREATE TABLE "exam_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"kind" text DEFAULT 'EXERCISE' NOT NULL,
	"bank_question_id" uuid,
	"title" text,
	"points" numeric(6, 2),
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_items_kind_check" CHECK ("exam_items"."kind" IN ('EXERCISE', 'QUESTION', 'TEXT', 'PAGE_BREAK'))
);
--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_workspace_id_teacher_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."teacher_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_source_exam_id_exams_id_fk" FOREIGN KEY ("source_exam_id") REFERENCES "public"."exams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_pdf_file_id_files_id_fk" FOREIGN KEY ("pdf_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_solution_pdf_file_id_files_id_fk" FOREIGN KEY ("solution_pdf_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_items" ADD CONSTRAINT "exam_items_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_items" ADD CONSTRAINT "exam_items_bank_question_id_bank_questions_id_fk" FOREIGN KEY ("bank_question_id") REFERENCES "public"."bank_questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exams_workspace_idx" ON "exams" USING btree ("workspace_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "exam_items_exam_idx" ON "exam_items" USING btree ("exam_id","position");--> statement-breakpoint
CREATE INDEX "exam_items_question_idx" ON "exam_items" USING btree ("bank_question_id");
