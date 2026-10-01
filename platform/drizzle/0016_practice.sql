-- Exam Builder — المرحلة 7: التدريب الذاتي للتلميذ (جداول إضافية فقط)
CREATE TABLE "practice_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"level_id" uuid,
	"stream_id" uuid,
	"curriculum_node_id" uuid,
	"difficulty" integer,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"question_count" integer DEFAULT 0 NOT NULL,
	"answered_count" integer DEFAULT 0 NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"score_pct" numeric(5, 2),
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_sessions_status_check" CHECK ("practice_sessions"."status" IN ('ACTIVE', 'FINISHED')),
	CONSTRAINT "practice_sessions_difficulty_check" CHECK ("practice_sessions"."difficulty" IS NULL OR "practice_sessions"."difficulty" BETWEEN 1 AND 4)
);
--> statement-breakpoint
CREATE TABLE "practice_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"answer" jsonb,
	"is_correct" boolean,
	"score" numeric(6, 2),
	"points" numeric(6, 2) DEFAULT '1' NOT NULL,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_curriculum_node_id_curriculum_nodes_id_fk" FOREIGN KEY ("curriculum_node_id") REFERENCES "public"."curriculum_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_answers" ADD CONSTRAINT "practice_answers_session_id_practice_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."practice_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_answers" ADD CONSTRAINT "practice_answers_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_answers" ADD CONSTRAINT "practice_answers_question_id_bank_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."bank_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "practice_sessions_student_idx" ON "practice_sessions" USING btree ("student_id","started_at");--> statement-breakpoint
CREATE INDEX "practice_answers_session_idx" ON "practice_answers" USING btree ("session_id","position");--> statement-breakpoint
CREATE INDEX "practice_answers_student_idx" ON "practice_answers" USING btree ("student_id","answered_at");--> statement-breakpoint
CREATE INDEX "practice_answers_question_idx" ON "practice_answers" USING btree ("question_id");
