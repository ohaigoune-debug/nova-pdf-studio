-- أكاديمية 2027: ربط الدروس (content) بالمادة وبعقدة المنهاج لترتيبها بترتيب الوحدات والدروس الفعلي.
-- إضافة فقط (أعمدة فارغة افتراضياً): المحتوى القديم غير المصنّف يبقى كما هو ويُعرض في قسم «غير مصنّف».
ALTER TABLE "content" ADD COLUMN IF NOT EXISTS "subject_id" uuid;
--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN IF NOT EXISTS "curriculum_node_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "content" ADD CONSTRAINT "content_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "content" ADD CONSTRAINT "content_curriculum_node_id_curriculum_nodes_id_fk" FOREIGN KEY ("curriculum_node_id") REFERENCES "public"."curriculum_nodes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_subject_idx" ON "content" USING btree ("subject_id","level_id","stream_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_node_idx" ON "content" USING btree ("curriculum_node_id");
