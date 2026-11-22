-- تمارين من بنك مدرسة PLAY تحت درس الدورة (22 نوفمبر 2026): لعبة درس أو بكالوريا/فرض، لمشتركي الدورة مجانًا.
CREATE TABLE IF NOT EXISTS "content_play_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "content_id" uuid NOT NULL REFERENCES "content"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "play_lesson_id" uuid REFERENCES "play_lessons"("id") ON DELETE CASCADE,
  "exam_set_id" uuid REFERENCES "play_exam_sets"("id") ON DELETE CASCADE,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "content_play_links_kind_check" CHECK (("kind" = 'LESSON' AND "play_lesson_id" IS NOT NULL AND "exam_set_id" IS NULL) OR ("kind" = 'EXAM_SET' AND "exam_set_id" IS NOT NULL AND "play_lesson_id" IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS "content_play_links_lesson_unique" ON "content_play_links" ("content_id", "play_lesson_id") WHERE "play_lesson_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "content_play_links_exam_unique" ON "content_play_links" ("content_id", "exam_set_id") WHERE "exam_set_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "content_play_links_content_idx" ON "content_play_links" ("content_id", "sort_order");
-- جولة/محاولة بدأت من تحت درس الدورة: الوصول باشتراك الدورة لا بتجربة PLAY
ALTER TABLE "play_sessions" ADD COLUMN IF NOT EXISTS "practice_link_id" uuid REFERENCES "content_play_links"("id") ON DELETE SET NULL;
ALTER TABLE "play_exam_attempts" ADD COLUMN IF NOT EXISTS "practice_link_id" uuid REFERENCES "content_play_links"("id") ON DELETE SET NULL;
