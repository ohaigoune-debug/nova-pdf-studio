-- مزوّد فيديو ثالث: Bunny Stream (رابط تضمين موقّع مؤقّت) + معرّف الفيديو عند Bunny. إضافة فقط.
ALTER TABLE "content" DROP CONSTRAINT IF EXISTS "content_video_provider_check";
--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_video_provider_check" CHECK ("video_provider" IS NULL OR "video_provider" IN ('YOUTUBE', 'UPLOAD', 'BUNNY'));
--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN IF NOT EXISTS "bunny_video_id" text;
