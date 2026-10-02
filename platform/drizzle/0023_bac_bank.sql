-- بنك البكالوريا الكامل: رقم الموضوع، اللغة، عدد الصفحات، بصمة الملفات، مراقبة الجودة، حالة «موثَّقة»، الحلّ المفصّل
-- (إضافات فقط: أعمدة بقيم افتراضية وتوسيع قيد الحالة؛ لا حذف ولا إعادة تسمية)
ALTER TABLE "exam_documents" DROP CONSTRAINT IF EXISTS "exam_documents_status_check";
--> statement-breakpoint
ALTER TABLE "exam_documents" ADD CONSTRAINT "exam_documents_status_check" CHECK ("exam_documents"."status" IN ('PENDING', 'PROCESSING', 'NEEDS_REVIEW', 'VERIFIED', 'PUBLISHED', 'FAILED'));
--> statement-breakpoint
ALTER TABLE "exam_documents" ADD COLUMN IF NOT EXISTS "topic_number" integer;
--> statement-breakpoint
ALTER TABLE "exam_documents" ADD COLUMN IF NOT EXISTS "language" text;
--> statement-breakpoint
ALTER TABLE "exam_documents" ADD COLUMN IF NOT EXISTS "pages_count" integer;
--> statement-breakpoint
ALTER TABLE "exam_documents" ADD COLUMN IF NOT EXISTS "pdf_hash" text;
--> statement-breakpoint
ALTER TABLE "exam_documents" ADD COLUMN IF NOT EXISTS "solution_pdf_hash" text;
--> statement-breakpoint
ALTER TABLE "exam_documents" ADD COLUMN IF NOT EXISTS "quality" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "exam_documents" ADD COLUMN IF NOT EXISTS "verified_by_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "exam_documents" ADD COLUMN IF NOT EXISTS "verified_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "exam_documents" ADD CONSTRAINT "exam_documents_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exam_documents_bac_key_idx" ON "exam_documents" USING btree ("subject_id","stream_id","exam_year","exam_session","topic_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exam_documents_pdf_hash_idx" ON "exam_documents" USING btree ("pdf_hash");
--> statement-breakpoint
ALTER TABLE "bank_questions" ADD COLUMN IF NOT EXISTS "solution_detail" jsonb;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_questions_solution_detail_idx" ON "bank_questions" USING btree ("document_id") WHERE "solution_detail" IS NULL AND "parent_id" IS NULL AND "deleted_at" IS NULL;
