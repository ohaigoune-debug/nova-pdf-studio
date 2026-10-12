-- دفعات النشر (صفحة «نشر» للأستاذ والمشرف): ملفات ← اقتراح تقسيم وتصنيف ← مراجعة ← نشر (إضافة فقط)
CREATE TABLE IF NOT EXISTS "upload_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"workspace_id" uuid,
	"status" text DEFAULT 'READY' NOT NULL,
	"mode" text DEFAULT 'manual' NOT NULL,
	"defaults" jsonb NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_content_id" uuid,
	"note" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "upload_batches_status_check" CHECK ("upload_batches"."status" IN ('ANALYZING', 'READY', 'PUBLISHED', 'FAILED'))
);
--> statement-breakpoint
ALTER TABLE "upload_batches" ADD CONSTRAINT "upload_batches_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "upload_batches" ADD CONSTRAINT "upload_batches_workspace_id_teacher_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."teacher_workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "upload_batches" ADD CONSTRAINT "upload_batches_source_content_id_content_id_fk" FOREIGN KEY ("source_content_id") REFERENCES "public"."content"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upload_batches_owner_idx" ON "upload_batches" USING btree ("owner_user_id","created_at");
