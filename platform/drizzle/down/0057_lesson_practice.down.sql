ALTER TABLE "play_exam_attempts" DROP COLUMN IF EXISTS "practice_link_id";
--> statement-breakpoint
ALTER TABLE "play_sessions" DROP COLUMN IF EXISTS "practice_link_id";
--> statement-breakpoint
DROP TABLE IF EXISTS "content_play_links";
