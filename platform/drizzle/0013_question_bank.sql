-- Exam Builder — المرحلة 1: بنك الأسئلة (جداول إضافية فقط؛ أسئلة الاختبارات الإلكترونية تبقى حيث هي)
CREATE TABLE "bank_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"author_user_id" uuid,
	"parent_id" uuid,
	"kind" text DEFAULT 'QUESTION' NOT NULL,
	"type" text DEFAULT 'OPEN' NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answer_key" jsonb,
	"solution" text,
	"bareme" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"points" numeric(6, 2) DEFAULT '1' NOT NULL,
	"difficulty" integer DEFAULT 2 NOT NULL,
	"estimated_minutes" integer,
	"subject_id" uuid,
	"level_id" uuid,
	"stream_id" uuid,
	"curriculum_node_id" uuid,
	"school_term" integer,
	"exam_kind" text,
	"source_id" uuid,
	"source_resource_id" uuid,
	"source_year" integer,
	"source_label" text,
	"original_file_id" uuid,
	"rights_status" text DEFAULT 'OWN' NOT NULL,
	"language" text DEFAULT 'ar' NOT NULL,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"image_file_id" uuid,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"visibility" text DEFAULT 'PRIVATE' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"import_batch_id" uuid,
	"content_hash" text,
	"search_text" text DEFAULT '' NOT NULL,
	"search" tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce("search_text", ''))) STORED,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "bank_questions_kind_check" CHECK ("bank_questions"."kind" IN ('QUESTION', 'EXERCISE', 'PASSAGE', 'PROBLEM', 'INTEGRATIVE', 'DOCUMENT')),
	CONSTRAINT "bank_questions_type_check" CHECK ("bank_questions"."type" IN ('MCQ', 'TRUE_FALSE', 'SHORT_ANSWER', 'LONG_ANSWER', 'FILL_BLANK', 'MATCHING', 'IMAGE', 'OPEN')),
	CONSTRAINT "bank_questions_status_check" CHECK ("bank_questions"."status" IN ('DRAFT', 'NEEDS_REVIEW', 'PUBLISHED', 'ARCHIVED')),
	CONSTRAINT "bank_questions_visibility_check" CHECK ("bank_questions"."visibility" IN ('PRIVATE', 'PUBLIC')),
	CONSTRAINT "bank_questions_rights_check" CHECK ("bank_questions"."rights_status" IN ('OWN', 'LICENSED', 'PUBLIC_DOMAIN', 'THIRD_PARTY', 'UNKNOWN')),
	CONSTRAINT "bank_questions_exam_kind_check" CHECK ("bank_questions"."exam_kind" IS NULL OR "bank_questions"."exam_kind" IN ('BAC', 'BEM', 'TEST', 'HOMEWORK', 'QUIZ', 'PRACTICE', 'OTHER')),
	CONSTRAINT "bank_questions_difficulty_check" CHECK ("bank_questions"."difficulty" BETWEEN 1 AND 4),
	CONSTRAINT "bank_questions_term_check" CHECK ("bank_questions"."school_term" IS NULL OR "bank_questions"."school_term" BETWEEN 1 AND 3),
	CONSTRAINT "bank_questions_points_check" CHECK ("bank_questions"."points" > 0)
);
--> statement-breakpoint
CREATE TABLE "bank_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_workspace_id_teacher_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."teacher_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_parent_id_bank_questions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."bank_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_curriculum_node_id_curriculum_nodes_id_fk" FOREIGN KEY ("curriculum_node_id") REFERENCES "public"."curriculum_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_source_id_content_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_source_resource_id_resources_id_fk" FOREIGN KEY ("source_resource_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_original_file_id_files_id_fk" FOREIGN KEY ("original_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_favorites" ADD CONSTRAINT "bank_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_favorites" ADD CONSTRAINT "bank_favorites_question_id_bank_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."bank_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_questions_browse_idx" ON "bank_questions" USING btree ("subject_id","level_id","stream_id","status");--> statement-breakpoint
CREATE INDEX "bank_questions_workspace_idx" ON "bank_questions" USING btree ("workspace_id","status","created_at");--> statement-breakpoint
CREATE INDEX "bank_questions_node_idx" ON "bank_questions" USING btree ("curriculum_node_id");--> statement-breakpoint
CREATE INDEX "bank_questions_parent_idx" ON "bank_questions" USING btree ("parent_id","sort_order");--> statement-breakpoint
CREATE INDEX "bank_questions_difficulty_idx" ON "bank_questions" USING btree ("difficulty","type");--> statement-breakpoint
CREATE INDEX "bank_questions_batch_idx" ON "bank_questions" USING btree ("import_batch_id");--> statement-breakpoint
CREATE INDEX "bank_questions_hash_idx" ON "bank_questions" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "bank_questions_search_idx" ON "bank_questions" USING gin ("search");--> statement-breakpoint
CREATE INDEX "bank_questions_keywords_idx" ON "bank_questions" USING gin ("keywords");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_favorites_unique" ON "bank_favorites" USING btree ("user_id","question_id");
