-- المرحلة 2: تقدّم المهام الطويلة (استيراد DzExams، تنظيم المكتبة) — أعمدة إضافية فقط
ALTER TABLE "jobs" ADD COLUMN "progress" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "total_items" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "processed_items" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "failed_items" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "logs" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "jobs_type_created_idx" ON "jobs" USING btree ("type","created_at");
