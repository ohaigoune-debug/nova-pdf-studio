CREATE TABLE "play_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"answer" jsonb,
	"is_correct" boolean NOT NULL,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"time_ms" integer,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "play_lesson_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"answered" integer DEFAULT 0 NOT NULL,
	"correct" integer DEFAULT 0 NOT NULL,
	"mastery_pct" integer DEFAULT 0 NOT NULL,
	"mastered_at" timestamp with time zone,
	"last_played_at" timestamp with time zone,
	"recent" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "play_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grade_code" text NOT NULL,
	"stream_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"subject_code" text NOT NULL,
	"unit_code" text NOT NULL,
	"unit_name" text NOT NULL,
	"unit_order" integer DEFAULT 0 NOT NULL,
	"lesson_code" text NOT NULL,
	"lesson_name" text NOT NULL,
	"lesson_order" integer DEFAULT 0 NOT NULL,
	"objective" text,
	"verified" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "play_question_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"box" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_result" boolean,
	"wrong_count" integer DEFAULT 0 NOT NULL,
	"correct_streak" integer DEFAULT 0 NOT NULL,
	"seen_count" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "play_question_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"student_id" uuid,
	"session_id" uuid,
	"reason" text NOT NULL,
	"message" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"resolved_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "play_reports_reason_check" CHECK ("play_question_reports"."reason" IN ('WRONG_ANSWER', 'AMBIGUOUS', 'TYPO', 'OFF_LESSON', 'OTHER')),
	CONSTRAINT "play_reports_status_check" CHECK ("play_question_reports"."status" IN ('OPEN', 'RESOLVED', 'DISMISSED'))
);
--> statement-breakpoint
CREATE TABLE "play_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"type" text NOT NULL,
	"grade_code" text NOT NULL,
	"stream_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"subject_code" text NOT NULL,
	"lesson_id" uuid NOT NULL,
	"unit_code" text NOT NULL,
	"lesson_code" text NOT NULL,
	"objective" text,
	"difficulty" text DEFAULT 'MEDIUM' NOT NULL,
	"language" text DEFAULT 'ar' NOT NULL,
	"question_text" text NOT NULL,
	"payload" jsonb NOT NULL,
	"answer_key" jsonb NOT NULL,
	"explanation" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"content_hash" text NOT NULL,
	"source" text DEFAULT 'AI_AUTHORED' NOT NULL,
	"review_status" text DEFAULT 'DRAFT' NOT NULL,
	"quality_flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"note" text,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"is_suspended" boolean DEFAULT false NOT NULL,
	"times_served" integer DEFAULT 0 NOT NULL,
	"times_correct" integer DEFAULT 0 NOT NULL,
	"times_wrong" integer DEFAULT 0 NOT NULL,
	"reports_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "play_questions_key_unique" UNIQUE("key"),
	CONSTRAINT "play_questions_type_check" CHECK ("play_questions"."type" IN ('MCQ', 'FILL_BLANK', 'MATCHING', 'ORDERING')),
	CONSTRAINT "play_questions_difficulty_check" CHECK ("play_questions"."difficulty" IN ('EASY', 'MEDIUM', 'HARD')),
	CONSTRAINT "play_questions_language_check" CHECK ("play_questions"."language" IN ('ar', 'fr', 'en')),
	CONSTRAINT "play_questions_review_check" CHECK ("play_questions"."review_status" IN ('DRAFT', 'AUTO_VALIDATED', 'NEEDS_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED')),
	CONSTRAINT "play_questions_source_check" CHECK ("play_questions"."source" IN ('AI_AUTHORED', 'TEACHER', 'IMPORT', 'LEGACY_QCM'))
);
--> statement-breakpoint
CREATE TABLE "play_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"grade_code" text NOT NULL,
	"stream_code" text,
	"subject_code" text,
	"unit_code" text,
	"lesson_id" uuid,
	"challenge_type" text NOT NULL,
	"timed" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"question_ids" uuid[] NOT NULL,
	"seed" integer NOT NULL,
	"answered_count" integer DEFAULT 0 NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"xp_earned" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "play_sessions_type_check" CHECK ("play_sessions"."challenge_type" IN ('QUICK10', 'LESSON_MASTERY', 'UNIT_REVIEW', 'DAILY', 'BAC', 'HARD', 'MISTAKES')),
	CONSTRAINT "play_sessions_status_check" CHECK ("play_sessions"."status" IN ('ACTIVE', 'COMPLETED', 'ABANDONED', 'EXPIRED'))
);
--> statement-breakpoint
CREATE TABLE "play_student_badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"badge_code" text NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "play_student_stats" (
	"student_id" uuid PRIMARY KEY NOT NULL,
	"grade_code" text,
	"stream_code" text,
	"xp_total" integer DEFAULT 0 NOT NULL,
	"level_index" integer DEFAULT 0 NOT NULL,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"last_active_date" date,
	"sessions_completed" integer DEFAULT 0 NOT NULL,
	"answered_total" integer DEFAULT 0 NOT NULL,
	"correct_total" integer DEFAULT 0 NOT NULL,
	"hard_correct_total" integer DEFAULT 0 NOT NULL,
	"lessons_mastered" integer DEFAULT 0 NOT NULL,
	"prefs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "play_subject_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"grade_code" text NOT NULL,
	"subject_code" text NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"answered" integer DEFAULT 0 NOT NULL,
	"correct" integer DEFAULT 0 NOT NULL,
	"last_played_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "play_subjects" (
	"code" text PRIMARY KEY NOT NULL,
	"name_ar" text NOT NULL,
	"name_fr" text,
	"language" text DEFAULT 'ar' NOT NULL,
	"color" text DEFAULT 'primary' NOT NULL,
	"icon" text DEFAULT 'BookOpen' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "play_answers" ADD CONSTRAINT "play_answers_session_id_play_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."play_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_answers" ADD CONSTRAINT "play_answers_question_id_play_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."play_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_answers" ADD CONSTRAINT "play_answers_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_lesson_progress" ADD CONSTRAINT "play_lesson_progress_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_lesson_progress" ADD CONSTRAINT "play_lesson_progress_lesson_id_play_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."play_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_lessons" ADD CONSTRAINT "play_lessons_subject_code_play_subjects_code_fk" FOREIGN KEY ("subject_code") REFERENCES "public"."play_subjects"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_question_memory" ADD CONSTRAINT "play_question_memory_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_question_memory" ADD CONSTRAINT "play_question_memory_question_id_play_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."play_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_question_memory" ADD CONSTRAINT "play_question_memory_lesson_id_play_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."play_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_question_reports" ADD CONSTRAINT "play_question_reports_question_id_play_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."play_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_question_reports" ADD CONSTRAINT "play_question_reports_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_question_reports" ADD CONSTRAINT "play_question_reports_session_id_play_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."play_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_question_reports" ADD CONSTRAINT "play_question_reports_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_questions" ADD CONSTRAINT "play_questions_subject_code_play_subjects_code_fk" FOREIGN KEY ("subject_code") REFERENCES "public"."play_subjects"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_questions" ADD CONSTRAINT "play_questions_lesson_id_play_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."play_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_questions" ADD CONSTRAINT "play_questions_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_subject_code_play_subjects_code_fk" FOREIGN KEY ("subject_code") REFERENCES "public"."play_subjects"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_lesson_id_play_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."play_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_student_badges" ADD CONSTRAINT "play_student_badges_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_student_stats" ADD CONSTRAINT "play_student_stats_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_subject_stats" ADD CONSTRAINT "play_subject_stats_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_subject_stats" ADD CONSTRAINT "play_subject_stats_subject_code_play_subjects_code_fk" FOREIGN KEY ("subject_code") REFERENCES "public"."play_subjects"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "play_answers_unique" ON "play_answers" USING btree ("session_id","question_id");--> statement-breakpoint
CREATE INDEX "play_answers_student_idx" ON "play_answers" USING btree ("student_id","answered_at");--> statement-breakpoint
CREATE INDEX "play_answers_question_idx" ON "play_answers" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "play_lesson_progress_unique" ON "play_lesson_progress" USING btree ("student_id","lesson_id");--> statement-breakpoint
CREATE INDEX "play_lesson_progress_student_idx" ON "play_lesson_progress" USING btree ("student_id","last_played_at");--> statement-breakpoint
CREATE UNIQUE INDEX "play_lessons_unique" ON "play_lessons" USING btree ("grade_code","subject_code","stream_codes","unit_code","lesson_code");--> statement-breakpoint
CREATE INDEX "play_lessons_grade_subject_idx" ON "play_lessons" USING btree ("grade_code","subject_code");--> statement-breakpoint
CREATE UNIQUE INDEX "play_question_memory_unique" ON "play_question_memory" USING btree ("student_id","question_id");--> statement-breakpoint
CREATE INDEX "play_question_memory_due_idx" ON "play_question_memory" USING btree ("student_id","due_at");--> statement-breakpoint
CREATE INDEX "play_reports_status_idx" ON "play_question_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "play_reports_question_idx" ON "play_question_reports" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "play_questions_pick_idx" ON "play_questions" USING btree ("grade_code","subject_code","lesson_id","review_status");--> statement-breakpoint
CREATE INDEX "play_questions_hash_idx" ON "play_questions" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "play_questions_review_idx" ON "play_questions" USING btree ("review_status","created_at");--> statement-breakpoint
CREATE INDEX "play_sessions_student_idx" ON "play_sessions" USING btree ("student_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "play_student_badges_unique" ON "play_student_badges" USING btree ("student_id","badge_code");--> statement-breakpoint
CREATE UNIQUE INDEX "play_subject_stats_unique" ON "play_subject_stats" USING btree ("student_id","grade_code","subject_code");