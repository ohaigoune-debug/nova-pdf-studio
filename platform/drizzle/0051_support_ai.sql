-- مساعد الدعم الذكي (قرار المالك، 18 نوفمبر 2026): يردّ على تذاكر التلاميذ بـ Claude من معطيات المنصة.
-- is_ai: الرسالة كتبها المساعد (ردّ للتلميذ، أو مسودّة داخلية للموظف) — تظهر باسم «مساعد مدرسة الذكي».
-- ai_paused: طلب التلميذ موظفًا أو أوقفه المشرف لهذه التذكرة: لا يكتب المساعد فيها بعد ذلك.
-- إضافة فقط: عمودان بقيمة افتراضية، لا يمسّان أي صفّ قائم.
ALTER TABLE "support_messages" ADD COLUMN IF NOT EXISTS "is_ai" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "ai_paused" boolean DEFAULT false NOT NULL;
