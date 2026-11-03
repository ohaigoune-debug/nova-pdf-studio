-- إشعارات تطبيق الآيفون (Build 15، 3 نوفمبر 2026): رمز جهاز Apple لكل تلميذ دخل من التطبيق ووافق على الإشعارات.
-- إضافة فقط: لا يمسّ أي جدول قائم.
CREATE TABLE IF NOT EXISTS "ios_push_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"environment" text DEFAULT 'production' NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ios_push_devices_token_unique" UNIQUE("token")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ios_push_devices" ADD CONSTRAINT "ios_push_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ios_push_devices_user_idx" ON "ios_push_devices" USING btree ("user_id");
