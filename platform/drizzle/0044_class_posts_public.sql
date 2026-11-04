-- «القسم العام» (قرار المالك، 4 نوفمبر 2026): منشور الأستاذ أو الإدارة يراه كل التلاميذ المسجّلين، والتلاميذ يعلّقون.
-- إضافة فقط: المنشورات القائمة تبقى كما هي (is_public = false).
ALTER TABLE "class_posts" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "class_posts_public_idx" ON "class_posts" USING btree ("is_public","created_at");
