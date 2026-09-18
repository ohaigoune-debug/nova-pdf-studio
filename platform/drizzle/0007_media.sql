CREATE TABLE "media_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"content_id" uuid NOT NULL,
	"file_id" uuid,
	"user_id" uuid NOT NULL,
	"student_id" uuid,
	"viewer_key" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seconds_watched" integer DEFAULT 0 NOT NULL,
	"max_position" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "video_provider" text;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "youtube_id" text;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "allow_download" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "status" text DEFAULT 'READY' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_views" ADD CONSTRAINT "media_views_workspace_id_teacher_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."teacher_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_views" ADD CONSTRAINT "media_views_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_views" ADD CONSTRAINT "media_views_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_views" ADD CONSTRAINT "media_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_views" ADD CONSTRAINT "media_views_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_views_content_user_idx" ON "media_views" USING btree ("content_id","user_id");--> statement-breakpoint
CREATE INDEX "media_views_user_seen_idx" ON "media_views" USING btree ("user_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "media_views_workspace_idx" ON "media_views" USING btree ("workspace_id","last_seen_at");--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_video_provider_check" CHECK ("content"."video_provider" IS NULL OR "content"."video_provider" IN ('YOUTUBE', 'UPLOAD'));--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_status_check" CHECK ("files"."status" IN ('PENDING', 'READY'));