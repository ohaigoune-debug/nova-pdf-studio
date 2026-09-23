CREATE TABLE "bac_exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'dzexams' NOT NULL,
	"subject_slug" text NOT NULL,
	"subject_name" text NOT NULL,
	"stream_slug" text,
	"stream_name" text,
	"year" integer,
	"title" text NOT NULL,
	"page_url" text NOT NULL,
	"exam_url" text,
	"correction_url" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bac_exams_page_url_unique" UNIQUE("page_url")
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "model_answer" text;--> statement-breakpoint
CREATE INDEX "bac_exams_subject_idx" ON "bac_exams" USING btree ("subject_slug","year");--> statement-breakpoint
CREATE INDEX "bac_exams_stream_idx" ON "bac_exams" USING btree ("stream_slug");