-- Exam Builder — المرحلة 11: سوق الأساتذة (جداول إضافية فقط)
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"teacher_user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"price_dzd" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"review_note" text,
	"subject_id" uuid,
	"level_id" uuid,
	"stream_id" uuid,
	"exam_id" uuid,
	"file_id" uuid,
	"question_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"product_id" uuid,
	"teachers_only" boolean DEFAULT false NOT NULL,
	"rights_confirmed" boolean DEFAULT false NOT NULL,
	"teacher_share_pct" integer DEFAULT 70 NOT NULL,
	"sales_count" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "listings_kind_check" CHECK ("listings"."kind" IN ('EXAM', 'EXERCISE_SET', 'SUMMARY', 'QUESTION_BANK')),
	CONSTRAINT "listings_status_check" CHECK ("listings"."status" IN ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED')),
	CONSTRAINT "listings_price_check" CHECK ("listings"."price_dzd" >= 0),
	CONSTRAINT "listings_share_check" CHECK ("listings"."teacher_share_pct" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "listing_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"buyer_user_id" uuid NOT NULL,
	"order_id" uuid,
	"price_dzd" integer DEFAULT 0 NOT NULL,
	"teacher_share_dzd" integer DEFAULT 0 NOT NULL,
	"platform_share_dzd" integer DEFAULT 0 NOT NULL,
	"delivered" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"amount_dzd" integer NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"note" text,
	"paid_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_payouts_status_check" CHECK ("teacher_payouts"."status" IN ('PENDING', 'PAID')),
	CONSTRAINT "teacher_payouts_amount_check" CHECK ("teacher_payouts"."amount_dzd" >= 0)
);
--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_workspace_id_teacher_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."teacher_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_teacher_user_id_users_id_fk" FOREIGN KEY ("teacher_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_purchases" ADD CONSTRAINT "listing_purchases_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_purchases" ADD CONSTRAINT "listing_purchases_buyer_user_id_users_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_purchases" ADD CONSTRAINT "listing_purchases_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_payouts" ADD CONSTRAINT "teacher_payouts_workspace_id_teacher_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."teacher_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_payouts" ADD CONSTRAINT "teacher_payouts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listings_workspace_idx" ON "listings" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "listings_status_idx" ON "listings" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_purchases_unique" ON "listing_purchases" USING btree ("listing_id","buyer_user_id");--> statement-breakpoint
CREATE INDEX "listing_purchases_buyer_idx" ON "listing_purchases" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE INDEX "listing_purchases_listing_idx" ON "listing_purchases" USING btree ("listing_id","created_at");--> statement-breakpoint
CREATE INDEX "teacher_payouts_workspace_idx" ON "teacher_payouts" USING btree ("workspace_id","created_at");
