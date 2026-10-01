-- تراجع عن 0017_adaptive: يزيل جدول التقدّم بالدرس فقط (يُعاد بناؤه من practice_answers عند الحاجة).
-- الاستعمال (بعد نسخة احتياطية): psql "$DATABASE_URL" -f drizzle/down/0017_adaptive.down.sql
-- ثم احذف سطر 0017 من drizzle.__drizzle_migrations إن أردت إعادة تطبيقها لاحقاً.
BEGIN;
DROP TABLE IF EXISTS "student_node_progress";
COMMIT;
