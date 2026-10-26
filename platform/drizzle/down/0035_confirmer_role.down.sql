-- تراجع عن 0035_confirmer_role. لا نُغيّر أدوار الموظفين أو نحذفهم آليًا عند التراجع.
-- الاستعمال بعد نسخة احتياطية:
--   psql "$DATABASE_URL" -f drizzle/down/0035_confirmer_role.down.sql
-- ثم احذف سطرها من سجل الترحيلات، وإلا لن تُطبَّق من جديد عند إعادة نشر هذه النسخة:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1793500000000;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "users" WHERE "role" = 'CONFIRMER') THEN
    RAISE EXCEPTION 'Reassign CONFIRMER accounts before rolling back migration 0035';
  END IF;
  ALTER TABLE "users" DROP CONSTRAINT "users_role_check";
  ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('SUPER_ADMIN', 'TEACHER', 'ASSISTANT', 'STUDENT', 'PUBLIC', 'PARENT'));
END $$;
