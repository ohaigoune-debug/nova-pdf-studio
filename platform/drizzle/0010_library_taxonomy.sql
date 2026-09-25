CREATE TABLE "education_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_fr" text NOT NULL,
	"exam_code" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "education_stages_code_unique" UNIQUE("code"),
	CONSTRAINT "education_stages_code_check" CHECK ("education_stages"."code" IN ('PRIMARY', 'MIDDLE', 'SECONDARY'))
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"slug" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_fr" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subjects_code_unique" UNIQUE("code"),
	CONSTRAINT "subjects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "curriculum_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"curriculum_version_id" uuid,
	"subject_id" uuid NOT NULL,
	"level_id" uuid NOT NULL,
	"stream_id" uuid,
	"parent_id" uuid,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"school_term" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "curriculum_nodes_unique" UNIQUE NULLS NOT DISTINCT("curriculum_version_id","subject_id","level_id","stream_id","parent_id","slug"),
	CONSTRAINT "curriculum_nodes_kind_check" CHECK ("curriculum_nodes"."kind" IN ('UNIT', 'CHAPTER', 'LESSON', 'TOPIC')),
	CONSTRAINT "curriculum_nodes_term_check" CHECK ("curriculum_nodes"."school_term" IS NULL OR "curriculum_nodes"."school_term" BETWEEN 1 AND 3)
);
--> statement-breakpoint
CREATE TABLE "curriculum_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"start_year" integer NOT NULL,
	"end_year" integer,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "curriculum_versions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "grade_streams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level_id" uuid NOT NULL,
	"stream_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subject_offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level_id" uuid NOT NULL,
	"stream_id" uuid,
	"subject_id" uuid NOT NULL,
	"curriculum_version_id" uuid,
	"is_exam_subject" boolean DEFAULT false NOT NULL,
	"coefficient" numeric(4, 1),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subject_offerings_unique" UNIQUE NULLS NOT DISTINCT("level_id","stream_id","subject_id","curriculum_version_id")
);
--> statement-breakpoint
CREATE TABLE "content_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"base_url" text,
	"attribution" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_sources_code_unique" UNIQUE("code"),
	CONSTRAINT "content_sources_type_check" CHECK ("content_sources"."type" IN ('DZEXAMS', 'YOUTUBE', 'HAIGOUN', 'MADRASADZ', 'OFFICIAL_EXAM', 'OTHER'))
);
--> statement-breakpoint
CREATE TABLE "resource_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"stage_id" uuid,
	"level_id" uuid,
	"stream_id" uuid,
	"subject_id" uuid,
	"curriculum_node_id" uuid,
	"curriculum_version_id" uuid,
	"school_term" integer,
	"academic_year" integer,
	"exam_year" integer,
	"exam_session" text,
	"difficulty" integer,
	"language" text DEFAULT 'ar' NOT NULL,
	"source_id" uuid NOT NULL,
	"source_url" text,
	"source_ref" text,
	"original_author" text,
	"file_id" uuid,
	"file_url" text,
	"thumbnail_url" text,
	"youtube_video_id" text,
	"youtube_channel_id" text,
	"has_solution" boolean DEFAULT false NOT NULL,
	"solution_resource_id" uuid,
	"is_official" boolean DEFAULT false NOT NULL,
	"is_ai_generated" boolean DEFAULT false NOT NULL,
	"access_level" text DEFAULT 'PUBLIC' NOT NULL,
	"workspace_id" uuid,
	"content_id" uuid,
	"status" text DEFAULT 'PUBLISHED' NOT NULL,
	"fingerprint" text NOT NULL,
	"content_hash" text,
	"last_checked_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "resources_fingerprint_unique" UNIQUE("fingerprint"),
	CONSTRAINT "resources_type_check" CHECK ("resources"."type" IN ('LESSON', 'SUMMARY', 'EXERCISE', 'HOMEWORK', 'TEST', 'EXAM', 'SOLUTION', 'VIDEO', 'PEDAGOGICAL', 'OTHER')),
	CONSTRAINT "resources_status_check" CHECK ("resources"."status" IN ('DRAFT', 'NEEDS_REVIEW', 'PUBLISHED', 'ARCHIVED', 'BROKEN')),
	CONSTRAINT "resources_access_check" CHECK ("resources"."access_level" IN ('PUBLIC', 'REGISTERED', 'STUDENTS', 'GROUP', 'PREMIUM')),
	CONSTRAINT "resources_session_check" CHECK ("resources"."exam_session" IS NULL OR "resources"."exam_session" IN ('NORMAL', 'MAKEUP', 'MOCK')),
	CONSTRAINT "resources_official_not_ai" CHECK (NOT ("resources"."is_official" AND "resources"."is_ai_generated")),
	CONSTRAINT "resources_difficulty_check" CHECK ("resources"."difficulty" IS NULL OR "resources"."difficulty" BETWEEN 1 AND 5),
	CONSTRAINT "resources_term_check" CHECK ("resources"."school_term" IS NULL OR "resources"."school_term" BETWEEN 1 AND 3)
);
--> statement-breakpoint
ALTER TABLE "levels" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "levels" ADD COLUMN "stage_id" uuid;--> statement-breakpoint
ALTER TABLE "streams" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "streams" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "subject_id" uuid;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "curriculum_node_id" uuid;--> statement-breakpoint
ALTER TABLE "curriculum_nodes" ADD CONSTRAINT "curriculum_nodes_curriculum_version_id_curriculum_versions_id_fk" FOREIGN KEY ("curriculum_version_id") REFERENCES "public"."curriculum_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_nodes" ADD CONSTRAINT "curriculum_nodes_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_nodes" ADD CONSTRAINT "curriculum_nodes_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_nodes" ADD CONSTRAINT "curriculum_nodes_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_nodes" ADD CONSTRAINT "curriculum_nodes_parent_id_curriculum_nodes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."curriculum_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_streams" ADD CONSTRAINT "grade_streams_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_streams" ADD CONSTRAINT "grade_streams_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_offerings" ADD CONSTRAINT "subject_offerings_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_offerings" ADD CONSTRAINT "subject_offerings_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_offerings" ADD CONSTRAINT "subject_offerings_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_offerings" ADD CONSTRAINT "subject_offerings_curriculum_version_id_curriculum_versions_id_fk" FOREIGN KEY ("curriculum_version_id") REFERENCES "public"."curriculum_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_groups" ADD CONSTRAINT "resource_groups_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_groups" ADD CONSTRAINT "resource_groups_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_stage_id_education_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."education_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_curriculum_node_id_curriculum_nodes_id_fk" FOREIGN KEY ("curriculum_node_id") REFERENCES "public"."curriculum_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_curriculum_version_id_curriculum_versions_id_fk" FOREIGN KEY ("curriculum_version_id") REFERENCES "public"."curriculum_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_source_id_content_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_solution_resource_id_resources_id_fk" FOREIGN KEY ("solution_resource_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_workspace_id_teacher_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."teacher_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "curriculum_nodes_scope_idx" ON "curriculum_nodes" USING btree ("subject_id","level_id","stream_id");--> statement-breakpoint
CREATE INDEX "curriculum_nodes_parent_idx" ON "curriculum_nodes" USING btree ("parent_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "grade_streams_unique" ON "grade_streams" USING btree ("level_id","stream_id");--> statement-breakpoint
CREATE INDEX "subject_offerings_subject_idx" ON "subject_offerings" USING btree ("subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_groups_unique" ON "resource_groups" USING btree ("resource_id","group_id");--> statement-breakpoint
CREATE INDEX "resource_groups_group_idx" ON "resource_groups" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "resources_browse_idx" ON "resources" USING btree ("subject_id","level_id","stream_id","type","status");--> statement-breakpoint
CREATE INDEX "resources_exam_idx" ON "resources" USING btree ("type","exam_year");--> statement-breakpoint
CREATE INDEX "resources_node_idx" ON "resources" USING btree ("curriculum_node_id");--> statement-breakpoint
CREATE INDEX "resources_source_idx" ON "resources" USING btree ("source_id","created_at");--> statement-breakpoint
CREATE INDEX "resources_status_idx" ON "resources" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "resources_content_hash_idx" ON "resources" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "resources_workspace_idx" ON "resources" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "levels" ADD CONSTRAINT "levels_stage_id_education_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."education_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streams" ADD CONSTRAINT "streams_parent_id_streams_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."streams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_curriculum_node_id_curriculum_nodes_id_fk" FOREIGN KEY ("curriculum_node_id") REFERENCES "public"."curriculum_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "levels_stage_idx" ON "levels" USING btree ("stage_id","sort_order");--> statement-breakpoint
CREATE INDEX "skills_subject_idx" ON "skills" USING btree ("subject_id");