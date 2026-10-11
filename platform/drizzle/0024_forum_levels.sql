-- المنتدى العامّ (للتلاميذ والأساتذة)، مستوى «اختبارات المستوى QCM»، والدرس الموحّد لفيديوهات القنوات
-- (إضافات فقط: جداول وأعمدة فارغة وفهارس؛ لا حذف ولا إعادة تسمية)
CREATE TABLE IF NOT EXISTS "forum_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"subject_id" uuid,
	"level_id" uuid,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"replies_count" integer DEFAULT 0 NOT NULL,
	"last_post_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "forum_threads_status_check" CHECK ("forum_threads"."status" IN ('OPEN', 'LOCKED', 'HIDDEN'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forum_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_thread_id_forum_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_threads_recent_idx" ON "forum_threads" USING btree ("pinned","last_post_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_threads_scope_idx" ON "forum_threads" USING btree ("level_id","subject_id","last_post_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_threads_author_idx" ON "forum_threads" USING btree ("author_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_posts_thread_idx" ON "forum_posts" USING btree ("thread_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_posts_author_idx" ON "forum_posts" USING btree ("author_user_id");
--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "level_id" uuid;
--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN IF NOT EXISTS "lesson_key" text;
--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN IF NOT EXISTS "lesson_title" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resources_lesson_idx" ON "resources" USING btree ("subject_id","level_id","lesson_key");
