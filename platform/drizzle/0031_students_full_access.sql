-- الوصول الشامل للتلاميذ المسجّلين بكود قبل التحوّل إلى الدورات المدفوعة (قرار المالك 2026-10-24).
-- إضافة فقط: عمود فارغ افتراضياً؛ يملؤه scripts/academy/grant-full-access.ts بموافقة المالك.
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "full_access_until" timestamp with time zone;
