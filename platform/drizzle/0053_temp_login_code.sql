-- التسجيل دون كلمة سر (قرار المالك، 18 نوفمبر 2026): من يسجّل من صفحة هبوط يأخذ رمز دخول من 6 أرقام
-- صالحًا 7 أيام بدل كلمة السر، ثم يُطلب منه إنشاء كلمة سر عادية (8 أحرف) دون أن يفقد دورته.
--   temp_password_until: نهاية صلاحية الرمز المؤقت (NULL = كلمة سر عادية، الحالة القديمة لكل الحسابات)
--   temp_code_sealed: الرمز نفسه مختومًا ليُعرض لصاحبه في لافتة التذكير (كلمة السر تبقى hash في password_hash)
--   temp_reminders: عدد تذكيرات الإشعار المرسلة (يوم 5 ثم يوم 7) فلا يتكرر التذكير
-- إضافة أعمدة فارغة فقط: لا يمسّ أي حساب قائم.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "temp_password_until" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "temp_code_sealed" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "temp_reminders" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_temp_password_idx" ON "users" USING btree ("temp_password_until") WHERE "temp_password_until" IS NOT NULL;
