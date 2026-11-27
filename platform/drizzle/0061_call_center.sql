-- مركز الاتصال الذكي (قرار المالك 27 نوفمبر 2026): المنصّة تقرّر من حالات 48HR (EcoTrack) متى تُرسل رسالة ومتى يُتّصل،
-- والصندوق المحلي في بوسعادة (Asterisk + بوابة Yeastar TG400L) يسحب المكالمات عبر HTTPS ويعيد النتائج. لا منفذ مفتوح عنده.
-- cc_contacts: الشريحة الثابتة لكل رقم (الزبون يرى الرقم نفسه دائمًا فيعيد الاتصال به).
CREATE TABLE IF NOT EXISTS "cc_contacts" (
  "phone" text PRIMARY KEY NOT NULL,
  "sim_slot" integer,
  "opted_out_at" timestamp with time zone,
  "last_contact_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "cc_contacts_phone_check" CHECK ("phone" ~ '^0[5-7][0-9]{8}$'),
  CONSTRAINT "cc_contacts_sim_check" CHECK ("sim_slot" IS NULL OR ("sim_slot" >= 1 AND "sim_slot" <= 32))
);
--> statement-breakpoint
-- cc_tasks: كل رسالة أو مكالمة مخطَّطة. dedupe_key فريد فلا تتكرّر القاعدة نفسها للطلب نفسه أبدًا.
CREATE TABLE IF NOT EXISTS "cc_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "kind" text NOT NULL,
  "rule" text NOT NULL,
  "dedupe_key" text NOT NULL,
  "target" text DEFAULT 'ORDER' NOT NULL,
  "phone" text NOT NULL,
  "sim_slot" integer,
  "script" text,
  "message" text,
  "status" text DEFAULT 'QUEUED' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 3 NOT NULL,
  "run_after" timestamp with time zone DEFAULT now() NOT NULL,
  "dispatched_at" timestamp with time zone,
  "lease_until" timestamp with time zone,
  "outcome" text,
  "digit" text,
  "duration_sec" integer,
  "result_action" text,
  "simulated" boolean DEFAULT false NOT NULL,
  "needs_human" boolean DEFAULT false NOT NULL,
  "human_reason" text,
  "context" text,
  "handled_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "handled_at" timestamp with time zone,
  "handled_note" text,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "cc_tasks_kind_check" CHECK ("kind" IN ('SMS', 'CALL')),
  CONSTRAINT "cc_tasks_status_check" CHECK ("status" IN ('QUEUED', 'DISPATCHED', 'DONE', 'FAILED', 'CANCELLED')),
  CONSTRAINT "cc_tasks_target_check" CHECK ("target" IN ('GUARDIAN', 'STUDENT', 'ORDER', 'CALLER')),
  CONSTRAINT "cc_tasks_outcome_check" CHECK ("outcome" IS NULL OR "outcome" IN ('ANSWERED', 'NO_ANSWER', 'BUSY', 'REJECTED', 'FAILED', 'SENT', 'SIMULATED')),
  CONSTRAINT "cc_tasks_attempts_check" CHECK ("attempts" >= 0 AND "max_attempts" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cc_tasks_dedupe_unique" ON "cc_tasks" ("dedupe_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cc_tasks_due_idx" ON "cc_tasks" ("status", "run_after");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cc_tasks_order_idx" ON "cc_tasks" ("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cc_tasks_human_idx" ON "cc_tasks" ("needs_human", "handled_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cc_tasks_phone_idx" ON "cc_tasks" ("phone", "created_at");
--> statement-breakpoint
-- cc_attempts: كل محاولة (للسقف اليومي لكل شريحة ولسجلّ الموظف)
CREATE TABLE IF NOT EXISTS "cc_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL REFERENCES "cc_tasks"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "sim_slot" integer,
  "phone" text NOT NULL,
  "outcome" text,
  "digit" text,
  "duration_sec" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  CONSTRAINT "cc_attempts_kind_check" CHECK ("kind" IN ('SMS', 'CALL'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cc_attempts_sim_day_idx" ON "cc_attempts" ("sim_slot", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cc_attempts_task_idx" ON "cc_attempts" ("task_id");
--> statement-breakpoint
-- cc_inbound: المكالمات الواردة (القائمة الصوتية): اختيار المتصل، ورسالته الصوتية بعد الصفارة، وحالة المعالجة.
CREATE TABLE IF NOT EXISTS "cc_inbound" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "phone" text NOT NULL,
  "sim_slot" integer,
  "choice" text,
  "duration_sec" integer,
  "recording_key" text,
  "recording_mime" text,
  "recording_bytes" integer,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "status" text DEFAULT 'NEW' NOT NULL,
  "handled_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "handled_at" timestamp with time zone,
  "handled_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "cc_inbound_status_check" CHECK ("status" IN ('NEW', 'DONE'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cc_inbound_status_idx" ON "cc_inbound" ("status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cc_inbound_phone_idx" ON "cc_inbound" ("phone", "created_at");
