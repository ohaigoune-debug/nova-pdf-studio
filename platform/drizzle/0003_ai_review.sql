ALTER TABLE "ai_evaluations" ADD COLUMN "requested_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_evaluations" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_evaluations" ADD CONSTRAINT "ai_evaluations_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_evaluations_workspace_idx" ON "ai_evaluations" USING btree ("workspace_id","status");