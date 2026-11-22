-- اجتماعات Zoom تُنشأ من المنصة نفسها (22 نوفمبر 2026): العلامة تعني أن المنصة أنشأت الاجتماع في حساب Zoom
-- المربوط، فتعديل العنوان أو الموعد يُحدَّث هناك، وإلغاء الحصة يحذفه.
ALTER TABLE "live_sessions" ADD COLUMN IF NOT EXISTS "zoom_auto" boolean DEFAULT false NOT NULL;
