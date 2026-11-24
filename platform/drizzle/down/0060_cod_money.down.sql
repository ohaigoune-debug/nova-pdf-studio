ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_cod_money_check";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "cod_fee_dzd";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "cod_received_by_user_id";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "cod_received_at";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "cod_money_checked_at";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "cod_money_status";
