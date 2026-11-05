-- الدخول والتسجيل بـ Google وApple (iCloud) — 5 نوفمبر 2026.
-- إضافة فقط: جدولان جديدان، ولا يمسّ أي جدول قائم.
CREATE TABLE IF NOT EXISTS "oauth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"email" text,
	"refresh_token" text,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_identities_provider_subject_unique" UNIQUE("provider","subject"),
	CONSTRAINT "oauth_identities_provider_check" CHECK ("oauth_identities"."provider" IN ('GOOGLE', 'APPLE'))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "oauth_identities" ADD CONSTRAINT "oauth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_identities_user_idx" ON "oauth_identities" USING btree ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"kind" text NOT NULL,
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"full_name" text,
	"user_id" uuid,
	"refresh_token" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_tickets_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "oauth_tickets_kind_check" CHECK ("oauth_tickets"."kind" IN ('SIGNUP', 'LOGIN')),
	CONSTRAINT "oauth_tickets_provider_check" CHECK ("oauth_tickets"."provider" IN ('GOOGLE', 'APPLE'))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "oauth_tickets" ADD CONSTRAINT "oauth_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_tickets_expires_idx" ON "oauth_tickets" USING btree ("expires_at");
