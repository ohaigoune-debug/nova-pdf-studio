-- Exam Builder — المرحلة 8: تقدّم التلميذ بالدرس (جدول إضافي فقط؛ يُغذّى من practice_answers)
CREATE TABLE "student_node_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"curriculum_node_id" uuid NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"correct" integer DEFAULT 0 NOT NULL,
	"score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"mastered_difficulty" integer DEFAULT 0 NOT NULL,
	"last_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_node_progress" ADD CONSTRAINT "student_node_progress_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_node_progress" ADD CONSTRAINT "student_node_progress_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_node_progress" ADD CONSTRAINT "student_node_progress_curriculum_node_id_curriculum_nodes_id_fk" FOREIGN KEY ("curriculum_node_id") REFERENCES "public"."curriculum_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "student_node_progress_unique" ON "student_node_progress" USING btree ("student_id","curriculum_node_id");--> statement-breakpoint
CREATE INDEX "student_node_progress_student_idx" ON "student_node_progress" USING btree ("student_id","subject_id");
