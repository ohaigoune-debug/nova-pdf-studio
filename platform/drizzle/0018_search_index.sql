-- Exam Builder — المرحلة 9: فهرس بحث نصّي على الموارد (عمود مولَّد + GIN؛ لا تغيير في الأعمدة القائمة)
-- النصّ يُطبَّع في SQL كما تطبّعه normalizeArabic (همزات، تاء مربوطة، ألف مقصورة، تشكيل) ليطابق استعلامات البحث
ALTER TABLE "resources" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (to_tsvector('simple', regexp_replace(translate(lower(coalesce("title", '') || ' ' || coalesce("description", '') || ' ' || coalesce("original_author", '')), 'أإآةىئؤ', 'اااهييو'), '[ًٌٍَُِّْـ]', '', 'g'))) STORED;--> statement-breakpoint
CREATE INDEX "resources_search_idx" ON "resources" USING gin ("search");
