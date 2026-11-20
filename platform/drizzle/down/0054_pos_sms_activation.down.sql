-- تراجع عن 0054_pos_sms_activation (يعود البيع في نقطة البيع بالكود وحده):
--   psql "$DATABASE_URL" -f drizzle/down/0054_pos_sms_activation.down.sql
-- ثم احذف سطرها من سجل الترحيلات، وإلا لن تُطبَّق من جديد عند إعادة نشر هذه النسخة:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1795300000000;
-- رموز POS غير المستهلكة تُحذف أولًا (القيد القديم لا يقبلها)، والحجوزات تبقى أكوادًا عادية تُكتب في /claim.
DELETE FROM "otp_codes" WHERE "purpose" = 'POS';
ALTER TABLE "otp_codes" DROP CONSTRAINT IF EXISTS "otp_codes_purpose_check";
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_purpose_check" CHECK ("otp_codes"."purpose" IN ('REGISTER', 'ORDER', 'CLAIM', 'RECOVER'));
DROP INDEX IF EXISTS "course_codes_sold_phone_idx";
ALTER TABLE "course_codes" DROP CONSTRAINT IF EXISTS "course_codes_sold_phone_check";
ALTER TABLE "course_codes" DROP CONSTRAINT IF EXISTS "course_codes_sold_via_check";
ALTER TABLE "course_codes" DROP COLUMN IF EXISTS "sold_via";
ALTER TABLE "course_codes" DROP COLUMN IF EXISTS "sold_phone";
