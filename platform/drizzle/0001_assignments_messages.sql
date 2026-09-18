CREATE TABLE "submission_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_messages_kind_check" CHECK ("submission_messages"."kind" IN ('ANSWER', 'FEEDBACK', 'REPLY', 'SYSTEM'))
);
--> statement-breakpoint
DROP INDEX "submissions_assignment_idx";--> statement-breakpoint
ALTER TABLE "assignment_submissions" ALTER COLUMN "status" SET DEFAULT 'DRAFT';--> statement-breakpoint
ALTER TABLE "assignment_submissions" ALTER COLUMN "submitted_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ALTER COLUMN "submitted_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "submission_messages" ADD CONSTRAINT "submission_messages_submission_id_assignment_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."assignment_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_messages" ADD CONSTRAINT "submission_messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submission_messages_submission_idx" ON "submission_messages" USING btree ("submission_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_unique_per_student" ON "assignment_submissions" USING btree ("assignment_id","student_id");