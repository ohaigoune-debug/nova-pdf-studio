-- تراجع عن 0028_bunny_provider (بعد نسخة احتياطية): psql "$DATABASE_URL" -f drizzle/down/0028_bunny_provider.down.sql
-- يفشل عمداً إن وُجد محتوى بمزوّد BUNNY (حوّله أو احذفه أولاً).
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "content" WHERE "video_provider" = 'BUNNY') THEN
    RAISE EXCEPTION 'content rows with video_provider = BUNNY exist; convert them before rolling back';
  END IF;
END $$;
ALTER TABLE "content" DROP CONSTRAINT IF EXISTS "content_video_provider_check";
ALTER TABLE "content" ADD CONSTRAINT "content_video_provider_check" CHECK ("video_provider" IS NULL OR "video_provider" IN ('YOUTUBE', 'UPLOAD'));
ALTER TABLE "content" DROP COLUMN IF EXISTS "bunny_video_id";
COMMIT;
