-- تراجع عن 0041_partners_referrals. بعد نسخة احتياطية فقط:
--   psql "$DATABASE_URL" -f drizzle/down/0041_partners_referrals.down.sql
-- ثم احذف سطرها من سجل الترحيلات، وإلا لن تُطبَّق من جديد عند إعادة نشر هذه النسخة:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1794100000000;
-- يتوقف إن وُجدت إحالات أو مكافآت أو رصيد مستعمل أو حسابات مسوّقين (سجلّ مالي لا يُحذف آليًّا).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "referrals")
     OR EXISTS (SELECT 1 FROM "credit_lots")
     OR EXISTS (SELECT 1 FROM "orders" WHERE "credit_dzd" > 0)
     OR EXISTS (SELECT 1 FROM "users" WHERE "role" = 'AFFILIATE') THEN
    RAISE EXCEPTION 'Referral or credit data exists: keep migration 0041';
  END IF;
  DROP TABLE IF EXISTS "affiliate_payouts";
  DROP TABLE IF EXISTS "credit_spends";
  DROP TABLE IF EXISTS "credit_lots";
  DROP TABLE IF EXISTS "referral_rewards";
  DROP TABLE IF EXISTS "referrals";
  DROP TABLE IF EXISTS "promo_codes";
  DROP TABLE IF EXISTS "affiliates";
  DROP TABLE IF EXISTS "partner_applications";
  ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_credit_check";
  ALTER TABLE "orders" DROP COLUMN IF EXISTS "credit_dzd";
  ALTER TABLE "users" DROP CONSTRAINT "users_role_check";
  ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('SUPER_ADMIN', 'CONFIRMER', 'CONTENT_UPLOADER', 'MANAGER', 'POINT_OF_SALE', 'TEACHER', 'ASSISTANT', 'STUDENT', 'PUBLIC', 'PARENT'));
END $$;
