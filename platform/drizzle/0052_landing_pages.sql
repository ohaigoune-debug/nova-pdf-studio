-- صفحات الهبوط (قرار المالك، 17 نوفمبر 2026): صفحة عامة لكل دورة على /go/<slug>، بروابط لكل مصدر
-- (إنستغرام، يوتيوب، فيسبوك...)، وعدّ الزوار يوميًا لكل مصدر، ونسبة كل طلب إلى صفحته ومصدره.
-- إضافة فقط: جدولان جديدان وعمودان اختياريان في الطلبات.
CREATE TABLE IF NOT EXISTS "landing_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"course_id" uuid NOT NULL,
	"headline" text NOT NULL,
	"subheadline" text,
	"video_url" text,
	"bullets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"about" text,
	"faq" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "landing_pages_slug_unique" UNIQUE("slug"),
	CONSTRAINT "landing_pages_slug_check" CHECK ("landing_pages"."slug" ~ '^[a-z0-9][a-z0-9-]{1,39}$')
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "landing_pages_course_idx" ON "landing_pages" USING btree ("course_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "landing_visits" (
	"landing_id" uuid NOT NULL,
	"day" date NOT NULL,
	"source" text NOT NULL,
	"visits" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "landing_visits_pk" PRIMARY KEY ("landing_id", "day", "source"),
	CONSTRAINT "landing_visits_source_check" CHECK ("landing_visits"."source" ~ '^[a-z0-9_-]{1,24}$')
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "landing_visits" ADD CONSTRAINT "landing_visits_landing_id_landing_pages_id_fk" FOREIGN KEY ("landing_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "landing_id" uuid;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "traffic_source" text;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "orders" ADD CONSTRAINT "orders_landing_id_landing_pages_id_fk" FOREIGN KEY ("landing_id") REFERENCES "public"."landing_pages"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_landing_idx" ON "orders" USING btree ("landing_id") WHERE "orders"."landing_id" IS NOT NULL;
