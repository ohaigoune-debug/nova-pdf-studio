-- لا نُغيّر أدوار الموظفين أو نحذفهم آليًا عند التراجع.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "users" WHERE "role" = 'CONFIRMER') THEN
    RAISE EXCEPTION 'Reassign CONFIRMER accounts before rolling back migration 0035';
  END IF;
  ALTER TABLE "users" DROP CONSTRAINT "users_role_check";
  ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('SUPER_ADMIN', 'TEACHER', 'ASSISTANT', 'STUDENT', 'PUBLIC', 'PARENT'));
END $$;
