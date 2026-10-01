-- تراجع عن 0014_exams: يزيل ورقة الامتحان وعناصرها فقط؛ بنك الأسئلة والاختبارات الإلكترونية لا تُمسّ.
-- الاستعمال (بعد نسخة احتياطية): psql "$DATABASE_URL" -f drizzle/down/0014_exams.down.sql
-- ثم احذف سطر 0014 من drizzle.__drizzle_migrations إن أردت إعادة تطبيقها لاحقاً.
BEGIN;
DROP TABLE IF EXISTS "exam_items";
DROP TABLE IF EXISTS "exams";
COMMIT;
