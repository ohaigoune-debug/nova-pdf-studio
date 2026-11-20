-- نقطة البيع تفعّل الدورة برمز SMS (قرار المالك، 18 نوفمبر 2026):
-- صاحب المكتبة يكتب هاتف التلميذ ← يصل التلميذ رمز ← يكتبه صاحب المكتبة ← تُفعَّل الدورة فورًا على حسابه،
-- أو تُحجز لرقمه إن لم يكن له حساب (تُفعَّل تلقائيًا حين يسجّل بالرقم ويؤكّده).
--   sold_phone: الهاتف الذي أُكِّد برمز SMS عند البيع (NULL = كود يُسلَّم يدًا بيد كما كان)
--   sold_via: CODE = كود يُكتب في /claim (الطريقة القديمة والكود الاحتياطي)، SMS = تفعيل برمز من المكتبة
-- otp_codes.purpose يقبل POS (رمز التفعيل في نقطة البيع).
-- إضافة أعمدة فارغة وتوسيع قيد فقط: لا يمسّ أي كود أو رمز قائم.
ALTER TABLE "course_codes" ADD COLUMN IF NOT EXISTS "sold_phone" text;
--> statement-breakpoint
ALTER TABLE "course_codes" ADD COLUMN IF NOT EXISTS "sold_via" text;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "course_codes" ADD CONSTRAINT "course_codes_sold_via_check" CHECK ("course_codes"."sold_via" IS NULL OR "course_codes"."sold_via" IN ('CODE', 'SMS'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "course_codes" ADD CONSTRAINT "course_codes_sold_phone_check" CHECK ("course_codes"."sold_phone" IS NULL OR "course_codes"."sold_phone" ~ '^0[5-7][0-9]{8}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
-- الحجز لرقم يُبحث عنه عند تأكيد كل هاتف
CREATE INDEX IF NOT EXISTS "course_codes_sold_phone_idx" ON "course_codes" USING btree ("sold_phone") WHERE "sold_phone" IS NOT NULL AND "status" = 'ACTIVE';
--> statement-breakpoint
ALTER TABLE "otp_codes" DROP CONSTRAINT IF EXISTS "otp_codes_purpose_check";
--> statement-breakpoint
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_purpose_check" CHECK ("otp_codes"."purpose" IN ('REGISTER', 'ORDER', 'CLAIM', 'RECOVER', 'POS'));
