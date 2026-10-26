-- توسيع دور المستخدم فقط، دون تعديل أي مستخدم أو صلاحية قائمة.
DO $$ BEGIN
  ALTER TABLE "users" DROP CONSTRAINT "users_role_check";
  ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('SUPER_ADMIN', 'CONFIRMER', 'TEACHER', 'ASSISTANT', 'STUDENT', 'PUBLIC', 'PARENT'));
END $$;
