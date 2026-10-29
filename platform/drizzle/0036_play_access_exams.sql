-- MADRASA PLAY: تجربة 72 ساعة، ومجموعات الفروض والاختبارات والبكالوريا ومحاولاتها.
-- جداول جديدة فقط؛ لا تعديل ولا حذف لأي جدول أو بيان قائم.
CREATE TABLE IF NOT EXISTS "play_access_trials" (
  "student_id" uuid PRIMARY KEY NOT NULL REFERENCES "students"("id") ON DELETE cascade,
  "started_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "play_access_trials_window_check" CHECK ("ends_at" > "started_at")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "play_exam_sets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "set_id" text NOT NULL,
  "kind" text NOT NULL,
  "grade_code" text NOT NULL,
  "stream_codes" text[] DEFAULT '{}' NOT NULL,
  "subject_code" text NOT NULL,
  "year" integer,
  "term" integer,
  "paper" integer,
  "title" text NOT NULL,
  "status" text DEFAULT 'NEEDS_HUMAN_REVIEW' NOT NULL,
  "publishable" boolean DEFAULT false NOT NULL,
  "score_total" double precision DEFAULT 20 NOT NULL,
  "step_count" integer DEFAULT 0 NOT NULL,
  "checksum" text NOT NULL,
  "document" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "play_exam_sets_set_id_unique" UNIQUE("set_id"),
  CONSTRAINT "play_exam_sets_kind_check" CHECK ("kind" IN ('BAC', 'DEVOIR', 'TEST')),
  CONSTRAINT "play_exam_sets_status_check" CHECK ("status" IN ('DISCOVERED', 'EXTRACTED', 'LINKED', 'DECOMPOSED', 'GENERATED', 'AUTO_VALIDATED', 'NEEDS_HUMAN_REVIEW', 'APPROVED', 'STAGED', 'BLOCKED')),
  CONSTRAINT "play_exam_sets_term_check" CHECK ("term" IS NULL OR "term" BETWEEN 1 AND 3),
  CONSTRAINT "play_exam_sets_paper_check" CHECK ("paper" IS NULL OR "paper" IN (1, 2))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "play_exam_sets_browse_idx" ON "play_exam_sets" ("grade_code", "subject_code", "kind", "publishable");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "play_exam_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
  "set_id" uuid NOT NULL REFERENCES "play_exam_sets"("id") ON DELETE cascade,
  "set_checksum" text NOT NULL,
  "mode" text NOT NULL,
  "status" text DEFAULT 'ACTIVE' NOT NULL,
  "answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "score" double precision DEFAULT 0 NOT NULL,
  "max_score" double precision DEFAULT 20 NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "play_exam_attempts_mode_check" CHECK ("mode" IN ('PRACTICE', 'EXAM')),
  CONSTRAINT "play_exam_attempts_status_check" CHECK ("status" IN ('ACTIVE', 'COMPLETED', 'ABANDONED'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "play_exam_attempts_student_idx" ON "play_exam_attempts" ("student_id", "started_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "play_exam_attempts_set_idx" ON "play_exam_attempts" ("set_id");
