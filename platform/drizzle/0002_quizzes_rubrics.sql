CREATE TABLE "quiz_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"group_id" uuid,
	"student_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "grades" ADD COLUMN "rubric_breakdown" jsonb;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD COLUMN "status" text DEFAULT 'IN_PROGRESS' NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD COLUMN "needs_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "max_attempts" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_targets" ADD CONSTRAINT "quiz_targets_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_targets" ADD CONSTRAINT "quiz_targets_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_targets" ADD CONSTRAINT "quiz_targets_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quiz_targets_quiz_idx" ON "quiz_targets" USING btree ("quiz_id");--> statement-breakpoint
CREATE INDEX "quiz_targets_group_idx" ON "quiz_targets" USING btree ("group_id");--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_workspace_id_teacher_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."teacher_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quiz_attempts_quiz_idx" ON "quiz_attempts" USING btree ("quiz_id","status");--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_status_check" CHECK ("quiz_attempts"."status" IN ('IN_PROGRESS', 'SUBMITTED', 'REVIEWED', 'EXPIRED'));