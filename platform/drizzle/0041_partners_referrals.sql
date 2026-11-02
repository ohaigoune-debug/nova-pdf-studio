-- المسوّقون بالعمولة ودعوة الزملاء والرصيد (قرار المالك 2 نوفمبر 2026). إضافة فقط.
--   1) دور AFFILIATE لحساب المسوّق (دخول بالهاتف وكلمة سر يرسلها مدير العمليات عبر واتساب).
--   2) affiliates: المسوّق المقبول (رابط صفحته، متابعوه، عمولته الثابتة عن كل تلميذ جديد يشتري).
--   3) promo_codes: كود واحد لكل مسوّق ولكل تلميذ (مجال واحد فلا يتكرر كود بين الاثنين).
--   4) referrals: من جاء بالتلميذ الجديد — أول كود يُثبَّت ولا يتغيّر (تلميذ واحد = إحالة واحدة).
--   5) referral_rewards: المكافأة عند تسليم أول طلب دورة للتلميذ الجديد: نقد للمسوّق، رصيد للتلميذ الداعي،
--      ورصيد ترحيبي للتلميذ الجديد. تُلغى إن أُرجع الطلب. قيد لا يُحذف.
--   6) credit_lots / credit_spends: الرصيد الرقمي بدفعات لكل منها تاريخ انتهاء (12 شهرًا افتراضيًّا)،
--      يُستعمل في شراء الدورات ويعود إن أُلغي الطلب. orders.credit_dzd = ما خُصم من الطلب بالرصيد.
--   7) affiliate_payouts: ما دُفع للمسوّق نقدًا (قيد لا يُحذف).
--   8) partner_applications: طلبات «كن شريكًا» (مسوّق، نقطة بيع، أستاذ) بانتظار مدير العمليات.
DO $$ BEGIN
  ALTER TABLE "users" DROP CONSTRAINT "users_role_check";
  ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('SUPER_ADMIN', 'CONFIRMER', 'CONTENT_UPLOADER', 'MANAGER', 'POINT_OF_SALE', 'AFFILIATE', 'TEACHER', 'ASSISTANT', 'STUDENT', 'PUBLIC', 'PARENT'));
END $$;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "credit_dzd" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_credit_check" CHECK ("orders"."credit_dzd" >= 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "partner_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"wilaya_id" uuid,
	"org_name" text,
	"address" text,
	"social_url" text,
	"followers" integer,
	"subject" text,
	"message" text,
	"status" text DEFAULT 'NEW' NOT NULL,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"result_entity_id" uuid,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_applications_kind_check" CHECK ("partner_applications"."kind" IN ('AFFILIATE', 'POINT_OF_SALE', 'TEACHER')),
	CONSTRAINT "partner_applications_status_check" CHECK ("partner_applications"."status" IN ('NEW', 'APPROVED', 'REJECTED')),
	CONSTRAINT "partner_applications_followers_check" CHECK ("partner_applications"."followers" IS NULL OR "partner_applications"."followers" >= 0)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "partner_applications" ADD CONSTRAINT "partner_applications_wilaya_id_wilayas_id_fk" FOREIGN KEY ("wilaya_id") REFERENCES "public"."wilayas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "partner_applications" ADD CONSTRAINT "partner_applications_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partner_applications_status_idx" ON "partner_applications" USING btree ("status", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wilaya_id" uuid,
	"social_url" text,
	"followers" integer,
	"commission_dzd" integer DEFAULT 300 NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"note" text,
	"application_id" uuid,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliates_status_check" CHECK ("affiliates"."status" IN ('ACTIVE', 'SUSPENDED')),
	CONSTRAINT "affiliates_commission_check" CHECK ("affiliates"."commission_dzd" >= 0),
	CONSTRAINT "affiliates_followers_check" CHECK ("affiliates"."followers" IS NULL OR "affiliates"."followers" >= 0)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_wilaya_id_wilayas_id_fk" FOREIGN KEY ("wilaya_id") REFERENCES "public"."wilayas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_application_id_partner_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."partner_applications"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "affiliates_user_unique" ON "affiliates" USING btree ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promo_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"kind" text NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_codes_kind_check" CHECK ("promo_codes"."kind" IN ('AFFILIATE', 'STUDENT')),
	CONSTRAINT "promo_codes_code_check" CHECK ("promo_codes"."code" ~ '^[A-Z0-9]{4,16}$')
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "promo_codes_code_unique" ON "promo_codes" USING btree ("code");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "promo_codes_owner_unique" ON "promo_codes" USING btree ("owner_user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referred_user_id" uuid NOT NULL,
	"code_id" uuid NOT NULL,
	"referrer_user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"order_id" uuid,
	"qualified_at" timestamp with time zone,
	"reminded_at" timestamp with time zone,
	"remind_count" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referrals_kind_check" CHECK ("referrals"."kind" IN ('AFFILIATE', 'STUDENT')),
	CONSTRAINT "referrals_source_check" CHECK ("referrals"."source" IN ('REGISTER', 'LINK', 'CHECKOUT', 'PAGE')),
	CONSTRAINT "referrals_status_check" CHECK ("referrals"."status" IN ('PENDING', 'QUALIFIED', 'REVERSED', 'VOID')),
	CONSTRAINT "referrals_not_self_check" CHECK ("referrals"."referred_user_id" <> "referrals"."referrer_user_id")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_code_id_promo_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."promo_codes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_user_id_users_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "referrals_referred_unique" ON "referrals" USING btree ("referred_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referrals_referrer_idx" ON "referrals" USING btree ("referrer_user_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referral_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_id" uuid NOT NULL,
	"beneficiary_user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount_dzd" integer NOT NULL,
	"status" text DEFAULT 'EARNED' NOT NULL,
	"order_id" uuid,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reversed_at" timestamp with time zone,
	"reverse_reason" text,
	"reversed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_rewards_kind_check" CHECK ("referral_rewards"."kind" IN ('AFFILIATE_CASH', 'REFERRER_CREDIT', 'WELCOME_CREDIT')),
	CONSTRAINT "referral_rewards_status_check" CHECK ("referral_rewards"."status" IN ('EARNED', 'REVERSED')),
	CONSTRAINT "referral_rewards_amount_check" CHECK ("referral_rewards"."amount_dzd" > 0)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referral_id_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_beneficiary_user_id_users_id_fk" FOREIGN KEY ("beneficiary_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_reversed_by_user_id_users_id_fk" FOREIGN KEY ("reversed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "referral_rewards_referral_kind_unique" ON "referral_rewards" USING btree ("referral_id", "kind");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referral_rewards_beneficiary_idx" ON "referral_rewards" USING btree ("beneficiary_user_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_dzd" integer NOT NULL,
	"remaining_dzd" integer NOT NULL,
	"source" text NOT NULL,
	"reward_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"note" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_lots_source_check" CHECK ("credit_lots"."source" IN ('REFERRAL', 'WELCOME', 'ADJUST')),
	CONSTRAINT "credit_lots_amount_check" CHECK ("credit_lots"."amount_dzd" > 0),
	CONSTRAINT "credit_lots_remaining_check" CHECK ("credit_lots"."remaining_dzd" >= 0 AND "credit_lots"."remaining_dzd" <= "credit_lots"."amount_dzd")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_lots" ADD CONSTRAINT "credit_lots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_lots" ADD CONSTRAINT "credit_lots_reward_id_referral_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."referral_rewards"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_lots" ADD CONSTRAINT "credit_lots_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_lots_user_idx" ON "credit_lots" USING btree ("user_id", "expires_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_spends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_dzd" integer NOT NULL,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_spends_amount_check" CHECK ("credit_spends"."amount_dzd" > 0)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_spends" ADD CONSTRAINT "credit_spends_lot_id_credit_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."credit_lots"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_spends" ADD CONSTRAINT "credit_spends_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_spends" ADD CONSTRAINT "credit_spends_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_spends_order_idx" ON "credit_spends" USING btree ("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_spends_lot_idx" ON "credit_spends" USING btree ("lot_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliate_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"amount_dzd" integer NOT NULL,
	"note" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_payouts_amount_check" CHECK ("affiliate_payouts"."amount_dzd" > 0)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_payouts_affiliate_idx" ON "affiliate_payouts" USING btree ("affiliate_id", "created_at");
