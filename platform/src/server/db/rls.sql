-- ---------------------------------------------------------------------------
-- Row Level Security — طبقة دفاع ثانية للإنتاج على PostgreSQL / Supabase.
-- التطبيق يعزل المستأجرين في طبقة الخدمات؛ هذه السياسات تمنع أي تسرّب حتى لو
-- وصل استعلام خاطئ. يُفعَّل بعد ضبط المتغيّرات في كل معاملة:
--   SET LOCAL app.user_id = '<uuid>'; SET LOCAL app.role = 'TEACHER'; SET LOCAL app.workspace_id = '<uuid>';
-- ولا يُطبَّق على دور الخدمة (service role) الذي يستعمله الـSeed والـMigrations.
-- ---------------------------------------------------------------------------

create or replace function app_current_role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('app.role', true), ''), 'ANON')
$$;
create or replace function app_current_workspace() returns uuid language sql stable as $$
  select nullif(current_setting('app.workspace_id', true), '')::uuid
$$;
create or replace function app_current_user() returns uuid language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;
create or replace function app_current_student() returns uuid language sql stable as $$
  select s.id from students s where s.user_id = app_current_user()
$$;

-- جداول المستأجر (تحمل workspace_id)
do $$
declare t text;
begin
  foreach t in array array[
    'groups','group_students','enrollment_codes','enrollment_code_batches','class_sessions','attendance_records',
    'scanner_sessions','assignments','assignment_submissions','grades','ai_evaluations'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_admin_all', t);
    execute format('create policy %I on %I for all using (app_current_role() = ''SUPER_ADMIN'')', t || '_admin_all', t);
    execute format('drop policy if exists %I on %I', t || '_teacher_ws', t);
    execute format('create policy %I on %I for all using (app_current_role() = ''TEACHER'' and workspace_id = app_current_workspace())', t || '_teacher_ws', t);
  end loop;
end $$;

-- مساعد الأستاذ (ASSISTANT): مساحة الأستاذ فقط — قراءة الأفواج والتسجيلات والأكواد لا تُمنح؛
-- الكتابة على جداول الحضور فقط (الحصص، السجلات، جلسات السكانر)
do $$
declare t text;
begin
  foreach t in array array['groups','group_students'] loop
    execute format('drop policy if exists %I on %I', t || '_assistant_ws', t);
    execute format('create policy %I on %I for select using (app_current_role() = ''ASSISTANT'' and workspace_id = app_current_workspace())', t || '_assistant_ws', t);
  end loop;
  foreach t in array array['class_sessions','attendance_records','scanner_sessions'] loop
    execute format('drop policy if exists %I on %I', t || '_assistant_ws', t);
    execute format('create policy %I on %I for all using (app_current_role() = ''ASSISTANT'' and workspace_id = app_current_workspace())', t || '_assistant_ws', t);
  end loop;
end $$;

-- أكواد المساعدين وعضوياتهم: الأستاذ يدير مساحته، والمساعد يقرأ عضويته فقط
alter table assistant_codes enable row level security;
alter table teacher_assistants enable row level security;
drop policy if exists assistant_codes_admin_all on assistant_codes;
create policy assistant_codes_admin_all on assistant_codes for all using (app_current_role() = 'SUPER_ADMIN');
drop policy if exists assistant_codes_teacher_ws on assistant_codes;
create policy assistant_codes_teacher_ws on assistant_codes for all using (app_current_role() = 'TEACHER' and workspace_id = app_current_workspace());
drop policy if exists teacher_assistants_admin_all on teacher_assistants;
create policy teacher_assistants_admin_all on teacher_assistants for all using (app_current_role() = 'SUPER_ADMIN');
drop policy if exists teacher_assistants_teacher_ws on teacher_assistants;
create policy teacher_assistants_teacher_ws on teacher_assistants for all using (app_current_role() = 'TEACHER' and workspace_id = app_current_workspace());
drop policy if exists teacher_assistants_self on teacher_assistants;
create policy teacher_assistants_self on teacher_assistants for select using (app_current_role() = 'ASSISTANT' and user_id = app_current_user());

-- الطالب: يقرأ فقط ما يخصه
drop policy if exists group_students_student_self on group_students;
create policy group_students_student_self on group_students for select
  using (app_current_role() = 'STUDENT' and student_id = app_current_student());

drop policy if exists attendance_student_self on attendance_records;
create policy attendance_student_self on attendance_records for select
  using (app_current_role() = 'STUDENT' and student_id = app_current_student());

drop policy if exists grades_student_self on grades;
create policy grades_student_self on grades for select
  using (app_current_role() = 'STUDENT' and student_id = app_current_student() and visible_to_student = true);

drop policy if exists groups_student_member on groups;
create policy groups_student_member on groups for select
  using (app_current_role() = 'STUDENT' and exists (
    select 1 from group_students gs where gs.group_id = groups.id and gs.student_id = app_current_student()
  ));

drop policy if exists class_sessions_student_member on class_sessions;
create policy class_sessions_student_member on class_sessions for select
  using (app_current_role() = 'STUDENT' and exists (
    select 1 from group_students gs where gs.group_id = class_sessions.group_id and gs.student_id = app_current_student()
  ));

-- بيانات المستخدم الشخصية
alter table users enable row level security;
alter table profiles enable row level security;
alter table notifications enable row level security;
alter table student_timeline enable row level security;

drop policy if exists users_self on users;
create policy users_self on users for select using (id = app_current_user() or app_current_role() in ('SUPER_ADMIN','TEACHER','ASSISTANT'));
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for all using (user_id = app_current_user() or app_current_role() in ('SUPER_ADMIN','TEACHER','ASSISTANT'));
drop policy if exists notifications_self on notifications;
create policy notifications_self on notifications for all using (user_id = app_current_user() or app_current_role() = 'SUPER_ADMIN');
drop policy if exists timeline_scope on student_timeline;
create policy timeline_scope on student_timeline for select using (
  app_current_role() = 'SUPER_ADMIN'
  or (app_current_role() in ('TEACHER','ASSISTANT') and workspace_id = app_current_workspace())
  or (app_current_role() = 'STUDENT' and student_id = app_current_student())
);
