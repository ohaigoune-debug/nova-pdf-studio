ALTER TABLE "play_exam_attempts" DROP COLUMN IF EXISTS "practice_link_id";
ALTER TABLE "play_sessions" DROP COLUMN IF EXISTS "practice_link_id";
DROP TABLE IF EXISTS "content_play_links";
