-- الأكاديمية المدفوعة (M8): الدورات، الاشتراكات، الحصص المباشرة، مطالبة الولي، OTP، أحداث التوصيل، مركز الشكاوى؛
-- وأعمدة إضافية على products/orders/profiles. إضافة فقط: لا حذف ولا تعديل لأعمدة موجودة.
CREATE TABLE IF NOT EXISTS "course_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_by_student_id" uuid,
	"claimed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "course_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"source" text DEFAULT 'MANUAL' NOT NULL,
	"order_id" uuid,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"accepted_terms_at" timestamp with time zone,
	"accepted_terms_version" integer,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"revoked_reason" text,
	"activated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_enrollments_source_check" CHECK ("course_enrollments"."source" IN ('BOOK_ORDER', 'MANUAL', 'GIFT', 'CLAIM')),
	CONSTRAINT "course_enrollments_status_check" CHECK ("course_enrollments"."status" IN ('ACTIVE', 'EXPIRED', 'REVOKED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "course_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"workspace_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"level_id" uuid,
	"stream_ids" uuid[] DEFAULT '{}' NOT NULL,
	"subject_id" uuid,
	"season" text NOT NULL,
	"plan" text DEFAULT 'ANNUAL' NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"access_ends_on" date,
	"price_dzd" integer DEFAULT 0 NOT NULL,
	"cover_file_id" uuid,
	"terms_text" text,
	"terms_version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "courses_slug_unique" UNIQUE("slug"),
	CONSTRAINT "courses_status_check" CHECK ("courses"."status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
	CONSTRAINT "courses_plan_check" CHECK ("courses"."plan" IN ('ANNUAL', 'TERM')),
	CONSTRAINT "courses_price_check" CHECK ("courses"."price_dzd" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delivery_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"tracking_id" text,
	"order_id" uuid,
	"status" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	CONSTRAINT "delivery_events_status_check" CHECK ("delivery_events"."status" IN ('CREATED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED', 'CANCELLED', 'UNKNOWN'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "live_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 90 NOT NULL,
	"provider" text DEFAULT 'ZOOM' NOT NULL,
	"join_url_sealed" text,
	"provider_meeting_id" text,
	"recording_content_id" uuid,
	"status" text DEFAULT 'SCHEDULED' NOT NULL,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "live_sessions_provider_check" CHECK ("live_sessions"."provider" IN ('ZOOM', 'MEET', 'YOUTUBE', 'OTHER')),
	CONSTRAINT "live_sessions_status_check" CHECK ("live_sessions"."status" IN ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"purpose" text NOT NULL,
	"user_id" uuid,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "otp_codes_purpose_check" CHECK ("otp_codes"."purpose" IN ('REGISTER', 'ORDER', 'CLAIM', 'RECOVER'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"file_id" uuid,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid,
	"order_id" uuid,
	"kind" text DEFAULT 'OTHER' NOT NULL,
	"subject" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"is_sensitive" boolean DEFAULT false NOT NULL,
	"assigned_to_user_id" uuid,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_tickets_kind_check" CHECK ("support_tickets"."kind" IN ('ORDER', 'DELIVERY', 'ACCESS', 'CONTENT', 'TEACHER', 'TECHNICAL', 'OTHER')),
	CONSTRAINT "support_tickets_status_check" CHECK ("support_tickets"."status" IN ('OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED'))
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "phone_verified_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "requires_stream" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "max_per_order" integer DEFAULT 20 NOT NULL;
--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_max_per_order_check";
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_max_per_order_check" CHECK ("products"."max_per_order" >= 1);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "otp_verified_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "stream_id" uuid;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "beneficiary_student_id" uuid;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_provider" text;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_tracking_id" text;
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "course_claims" ADD CONSTRAINT "course_claims_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "course_claims" ADD CONSTRAINT "course_claims_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "course_claims" ADD CONSTRAINT "course_claims_claimed_by_student_id_students_id_fk" FOREIGN KEY ("claimed_by_student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_activated_by_user_id_users_id_fk" FOREIGN KEY ("activated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "course_products" ADD CONSTRAINT "course_products_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "course_products" ADD CONSTRAINT "course_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_workspace_id_teacher_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."teacher_workspaces"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_cover_file_id_files_id_fk" FOREIGN KEY ("cover_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_recording_content_id_content_id_fk" FOREIGN KEY ("recording_content_id") REFERENCES "public"."content"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_tracking_idx" ON "orders" USING btree ("delivery_provider","delivery_tracking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_claims_order_idx" ON "course_claims" USING btree ("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_claims_phone_idx" ON "course_claims" USING btree ("phone","claimed_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_enrollments_unique" ON "course_enrollments" USING btree ("course_id","student_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_enrollments_student_idx" ON "course_enrollments" USING btree ("student_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_enrollments_expiry_idx" ON "course_enrollments" USING btree ("status","expires_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_products_unique" ON "course_products" USING btree ("course_id","product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_products_product_idx" ON "course_products" USING btree ("product_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "courses_group_unique" ON "courses" USING btree ("group_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courses_status_idx" ON "courses" USING btree ("status","season");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_events_external_unique" ON "delivery_events" USING btree ("provider","external_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_events_order_idx" ON "delivery_events" USING btree ("order_id","received_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_sessions_course_idx" ON "live_sessions" USING btree ("course_id","starts_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_sessions_upcoming_idx" ON "live_sessions" USING btree ("status","starts_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "otp_codes_phone_idx" ON "otp_codes" USING btree ("phone","purpose","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_messages_ticket_idx" ON "support_messages" USING btree ("ticket_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "support_tickets_number_unique" ON "support_tickets" USING btree ("number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_tickets_user_idx" ON "support_tickets" USING btree ("user_id","last_message_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_tickets_status_idx" ON "support_tickets" USING btree ("status","last_message_at");

