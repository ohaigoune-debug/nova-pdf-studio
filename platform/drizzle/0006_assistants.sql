CREATE TABLE "assistant_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"code_prefix" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"expires_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	"used_by_user_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_codes_code_hash_unique" UNIQUE("code_hash"),
	CONSTRAINT "assistant_codes_status_check" CHECK ("assistant_codes"."status" IN ('ACTIVE', 'USED', 'DISABLED', 'EXPIRED'))
);
--> statement-breakpoint
CREATE TABLE "teacher_assistants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"joined_via_code_id" uuid,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_assistants_status_check" CHECK ("teacher_assistants"."status" IN ('ACTIVE', 'REVOKED'))
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_role_check";--> statement-breakpoint
ALTER TABLE "assistant_codes" ADD CONSTRAINT "assistant_codes_workspace_id_teacher_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."teacher_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_codes" ADD CONSTRAINT "assistant_codes_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_codes" ADD CONSTRAINT "assistant_codes_used_by_user_id_users_id_fk" FOREIGN KEY ("used_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_codes" ADD CONSTRAINT "assistant_codes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_assistants" ADD CONSTRAINT "teacher_assistants_workspace_id_teacher_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."teacher_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_assistants" ADD CONSTRAINT "teacher_assistants_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_assistants" ADD CONSTRAINT "teacher_assistants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_assistants" ADD CONSTRAINT "teacher_assistants_joined_via_code_id_assistant_codes_id_fk" FOREIGN KEY ("joined_via_code_id") REFERENCES "public"."assistant_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_assistants" ADD CONSTRAINT "teacher_assistants_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_codes_workspace_status_idx" ON "assistant_codes" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "assistant_codes_email_idx" ON "assistant_codes" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_assistants_active_user_unique" ON "teacher_assistants" USING btree ("user_id") WHERE "teacher_assistants"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "teacher_assistants_workspace_idx" ON "teacher_assistants" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "teacher_assistants_user_idx" ON "teacher_assistants" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('SUPER_ADMIN', 'TEACHER', 'ASSISTANT', 'STUDENT', 'PUBLIC', 'PARENT'));