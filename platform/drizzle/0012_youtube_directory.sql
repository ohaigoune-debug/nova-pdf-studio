-- المرحلة 5 (جزء): دليل الأساتذة/قنوات يوتيوب — جداول إضافية وعمود nullable في resources
CREATE TABLE "educators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"stage_id" uuid,
	"note" text,
	"status" text DEFAULT 'SUGGESTED' NOT NULL,
	"youtube_channel_id" text,
	"channel_title" text,
	"channel_handle" text,
	"channel_thumbnail" text,
	"subscriber_count" integer,
	"video_count" integer,
	"uploads_playlist_id" text,
	"candidates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resolved_at" timestamp with time zone,
	"synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "educators_name_key_unique" UNIQUE("name_key"),
	CONSTRAINT "educators_youtube_channel_id_unique" UNIQUE("youtube_channel_id"),
	CONSTRAINT "educators_status_check" CHECK ("educators"."status" IN ('SUGGESTED', 'APPROVED', 'REJECTED'))
);
--> statement-breakpoint
CREATE TABLE "educator_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"educator_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"rank" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "educators" ADD CONSTRAINT "educators_stage_id_education_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."education_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "educator_subjects" ADD CONSTRAINT "educator_subjects_educator_id_educators_id_fk" FOREIGN KEY ("educator_id") REFERENCES "public"."educators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "educator_subjects" ADD CONSTRAINT "educator_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "educator_subjects_unique" ON "educator_subjects" USING btree ("educator_id","subject_id");--> statement-breakpoint
CREATE INDEX "educator_subjects_subject_idx" ON "educator_subjects" USING btree ("subject_id","rank");--> statement-breakpoint
CREATE INDEX "educators_status_idx" ON "educators" USING btree ("status");--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "educator_id" uuid;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_educator_id_educators_id_fk" FOREIGN KEY ("educator_id") REFERENCES "public"."educators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resources_educator_idx" ON "resources" USING btree ("educator_id","created_at");
