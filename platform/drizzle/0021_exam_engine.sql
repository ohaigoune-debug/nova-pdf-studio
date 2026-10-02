-- MADRASADZ EXAM ENGINE — المرحلة 1: سجلّ الوثائق، أصل التمرين، تدرّج الأستاذ، استهلاك الذكاء الاصطناعي، تعليقات Beta
-- (جداول وأعمدة إضافية فقط؛ لا يُحذف أو يُعاد تسمية شيء)
CREATE TABLE "exam_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid,
	"solution_resource_id" uuid,
	"title" text NOT NULL,
	"doc_type" text DEFAULT 'BAC' NOT NULL,
	"subject_id" uuid,
	"level_id" uuid,
	"stream_id" uuid,
	"school_term" integer,
	"exam_year" integer,
	"exam_session" text,
	"source_id" uuid,
	"source_url" text,
	"file_id" uuid,
	"solution_file_id" uuid,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"error" text,
	"text_chars" integer DEFAULT 0 NOT NULL,
	"exercises_count" integer DEFAULT 0 NOT NULL,
	"duplicates_count" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"ai_cost_usd" numeric(10, 6) DEFAULT '0' NOT NULL,
	"processed_at" timestamp with time zone,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_documents_status_check" CHECK ("exam_documents"."status" IN ('PENDING', 'PROCESSING', 'NEEDS_REVIEW', 'PUBLISHED', 'FAILED')),
	CONSTRAINT "exam_documents_type_check" CHECK ("exam_documents"."doc_type" IN ('BAC', 'BEM', 'TEST', 'HOMEWORK', 'EXERCISE_SET', 'OTHER')),
	CONSTRAINT "exam_documents_term_check" CHECK ("exam_documents"."school_term" IS NULL OR "exam_documents"."school_term" BETWEEN 1 AND 3)
);
--> statement-breakpoint
CREATE TABLE "teacher_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"level_id" uuid NOT NULL,
	"stream_id" uuid,
	"node_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_progress_unique" UNIQUE NULLS NOT DISTINCT("workspace_id","subject_id","level_id","stream_id")
);
--> statement-breakpoint
CREATE TABLE "ai_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"task" text NOT NULL,
	"workspace_id" uuid,
	"user_id" uuid,
	"entity_type" text,
	"entity_id" uuid,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(10, 6) DEFAULT '0' NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"ok" boolean DEFAULT true NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"user_id" uuid,
	"exam_id" uuid,
	"kind" text DEFAULT 'SUGGESTION' NOT NULL,
	"rating" integer,
	"message" text NOT NULL,
	"page" text,
	"status" text DEFAULT 'NEW' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_feedback_kind_check" CHECK ("exam_feedback"."kind" IN ('BUG', 'SUGGESTION', 'RATING')),
	CONSTRAINT "exam_feedback_status_check" CHECK ("exam_feedback"."status" IN ('NEW', 'REVIEWED', 'DONE')),
	CONSTRAINT "exam_feedback_rating_check" CHECK ("exam_feedback"."rating" IS NULL OR "exam_feedback"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
ALTER TABLE "bank_questions" ADD COLUMN "origin" text DEFAULT 'ORIGINAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_questions" ADD COLUMN "document_id" uuid;--> statement-breakpoint
ALTER TABLE "bank_questions" ADD COLUMN "source_exercise_no" integer;--> statement-breakpoint
ALTER TABLE "bank_questions" ADD COLUMN "source_topic_no" integer;--> statement-breakpoint
ALTER TABLE "bank_questions" ADD COLUMN "ai_confidence" numeric(4, 3);--> statement-breakpoint
ALTER TABLE "bank_questions" ADD COLUMN "skills" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_origin_check" CHECK ("bank_questions"."origin" IN ('ORIGINAL', 'SOURCED', 'AI_GENERATED', 'ADAPTED'));--> statement-breakpoint
-- أصل ما سبق: المولَّد بالذكاء الاصطناعي موسوم بوصفه، والمستخرج من ملف/مورد مصدره معروف
UPDATE "bank_questions" SET "origin" = 'AI_GENERATED' WHERE "source_label" = 'مولَّد بالذكاء الاصطناعي';--> statement-breakpoint
UPDATE "bank_questions" SET "origin" = 'SOURCED' WHERE "origin" = 'ORIGINAL' AND ("original_file_id" IS NOT NULL OR "source_resource_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "exam_documents" ADD CONSTRAINT "exam_documents_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_documents" ADD CONSTRAINT "exam_documents_solution_resource_id_resources_id_fk" FOREIGN KEY ("solution_resource_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_documents" ADD CONSTRAINT "exam_documents_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_documents" ADD CONSTRAINT "exam_documents_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_documents" ADD CONSTRAINT "exam_documents_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_documents" ADD CONSTRAINT "exam_documents_source_id_content_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_documents" ADD CONSTRAINT "exam_documents_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_documents" ADD CONSTRAINT "exam_documents_solution_file_id_files_id_fk" FOREIGN KEY ("solution_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_documents" ADD CONSTRAINT "exam_documents_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_progress" ADD CONSTRAINT "teacher_progress_workspace_id_teacher_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."teacher_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_progress" ADD CONSTRAINT "teacher_progress_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_progress" ADD CONSTRAINT "teacher_progress_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_progress" ADD CONSTRAINT "teacher_progress_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_progress" ADD CONSTRAINT "teacher_progress_node_id_curriculum_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."curriculum_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_progress" ADD CONSTRAINT "teacher_progress_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_workspace_id_teacher_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."teacher_workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_feedback" ADD CONSTRAINT "exam_feedback_workspace_id_teacher_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."teacher_workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_feedback" ADD CONSTRAINT "exam_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_feedback" ADD CONSTRAINT "exam_feedback_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_document_id_exam_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."exam_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exam_documents_resource_unique" ON "exam_documents" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "exam_documents_status_idx" ON "exam_documents" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "exam_documents_scope_idx" ON "exam_documents" USING btree ("subject_id","level_id","stream_id","exam_year");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_created_idx" ON "ai_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_task_idx" ON "ai_usage_logs" USING btree ("task","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_entity_idx" ON "ai_usage_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "exam_feedback_status_idx" ON "exam_feedback" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "bank_questions_document_idx" ON "bank_questions" USING btree ("document_id","source_exercise_no");--> statement-breakpoint
CREATE INDEX "bank_questions_origin_idx" ON "bank_questions" USING btree ("origin","status");
