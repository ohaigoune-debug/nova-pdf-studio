-- دخول الحصص المباشرة داخل المنصة بـ Zoom Meeting SDK (22 نوفمبر 2026):
-- الـSDK لا يقبل رمز الرابط المشفّر (pwd=…)، بل رمز الاجتماع نفسه (Passcode) كما يظهر في Zoom.
-- يُحفظ مشفّرًا كرابط الانضمام، ولا يُعرض في أي صفحة.
ALTER TABLE "live_sessions" ADD COLUMN IF NOT EXISTS "meeting_passcode_sealed" text;
