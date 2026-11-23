-- أجر «الأستاذ المساعد» (قرار المالك 23 نوفمبر 2026): محتواه المرفوع بالصّفحة، ووسم «تصحيح تعبير»، والكشوف الشّهريّة المدفوعة.
CREATE TABLE IF NOT EXISTS "assistant_content" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "assistant_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid REFERENCES "teacher_workspaces"("id") ON DELETE SET NULL,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "pages" integer NOT NULL,
  "file_id" uuid NOT NULL REFERENCES "files"("id"),
  "note" text,
  "removed_at" timestamp with time zone,
  "removed_by_user_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "assistant_content_kind_check" CHECK ("kind" IN ('SUMMARY', 'EXERCISES', 'EXAM', 'PROPOSAL')),
  CONSTRAINT "assistant_content_pages_check" CHECK ("pages" > 0 AND "pages" <= 500)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assistant_content_user_created_idx" ON "assistant_content" ("assistant_user_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assistant_reply_marks" (
  "comment_id" uuid PRIMARY KEY NOT NULL REFERENCES "class_comments"("id") ON DELETE CASCADE,
  "kind" text DEFAULT 'CORRECTION' NOT NULL,
  "marked_by_user_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "assistant_reply_marks_kind_check" CHECK ("kind" IN ('CORRECTION'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assistant_payouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "assistant_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "month" text NOT NULL,
  "amount" integer NOT NULL,
  "breakdown" jsonb NOT NULL,
  "paid_at" timestamp with time zone DEFAULT now() NOT NULL,
  "paid_by_user_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assistant_payouts_user_month_unique" ON "assistant_payouts" ("assistant_user_id", "month");
