# مخطط قاعدة البيانات — DATABASE_SCHEMA

PostgreSQL. كل جدول: `id uuid PK` (`gen_random_uuid()`), `created_at`, `updated_at` (timestamptz). الحذف الناعم عبر `deleted_at` حيث يلزم. الحالات نصية مع قيود `CHECK` (لسهولة التوسعة). المصدر الوحيد للحقيقة هو `src/server/db/schema/*.ts` والـMigrations في `drizzle/`.

## ERD (مبسّط)

```
users 1─1 profiles
users 1─* sessions (devices)
users 1─0..1 teachers ─1 teacher_workspaces (tenant)
users 1─0..1 students
wilayas 1─* schools
teacher_workspaces 1─* schools (خاصة بالمساحة أو عامة workspace_id NULL)
teacher_workspaces 1─* groups ─* group_students ─1 students
groups ─1 levels, ─1 streams, ─1 academic_years, ─0..1 schools
groups 1─* enrollment_codes (batch_id للدفعات)
groups 1─* class_sessions 1─* attendance_records ─1 students
class_sessions 1─* scanner_sessions
group_students 1─* student_status_history
students 1─* student_timeline, notifications(users), student_skills ─1 skills ─* student_skill_history
teacher_workspaces 1─* content ─* files
assignments ─* assignment_targets, ─* assignment_submissions ─0..1 ai_evaluations ─0..1 teacher_reviews ─0..1 grades
quizzes 1─* questions 1─* question_options ; quizzes 1─* quiz_attempts 1─* answers
rubrics 1─* rubric_items
audit_logs, activity_logs, jobs, qr_nonces
```

## الجداول

### الهوية والمستأجرون

| جدول | الأعمدة الأساسية | ملاحظات |
|---|---|---|
| `users` | `email` (unique, lowercase), `password_hash`, `role` CHECK IN (SUPER_ADMIN, TEACHER, ASSISTANT, STUDENT, PUBLIC, PARENT*), `status` (ACTIVE/DISABLED), `email_verified_at`, `last_login_at`, `deleted_at` | PARENT محجوز |
| `profiles` | `user_id` (unique FK), `full_name`, `phone`, `avatar_file_id`, `locale` (ar/fr/en), `theme` | |
| `sessions` | `user_id`, `token_hash` (unique), `device_name`, `user_agent`, `ip`, `expires_at`, `revoked_at`, `last_seen_at` | إدارة الأجهزة/الجلسات |
| `password_resets` | `user_id`, `token_hash`, `expires_at`, `used_at` | |
| `teacher_workspaces` | `owner_user_id`, `name`, `slug` (unique), `plan` (FREE), `status`, `settings jsonb` | المستأجر (Tenant) |
| `teachers` | `user_id` (unique), `workspace_id`, `display_name`, `subject`, `bio` | أستاذ ↔ مساحة |
| `assistant_codes` | `workspace_id`, `teacher_id`, `email` (lowercase، الكود لا يعمل إلا معه), `code_hash` (unique), `code_prefix`, `status` (ACTIVE/USED/DISABLED/EXPIRED), `expires_at`, `used_by_user_id`, `used_at`, `created_by_user_id`, `disabled_at` | كود دعوة مساعد، يُعرض مرة واحدة |
| `teacher_assistants` | `workspace_id`, `teacher_id`, `user_id`, `status` (ACTIVE/REVOKED), `joined_via_code_id`, `revoked_at`, `revoked_by_user_id` | **unique جزئي** على `user_id` حيث `status='ACTIVE'`: عضوية نشطة واحدة لكل مساعد |
| `students` | `user_id` (unique), `student_type` (IN_PERSON/COURSE/ONLINE/FREE/EXTERNAL), `wilaya_id`, `school_id`, `level_id`, `stream_id`, `guardian_phone`, `birth_date` | الطالب كيان عام، والانتماء لأستاذ عبر `group_students` |

### المرجعية الأكاديمية

| جدول | الأعمدة | ملاحظات |
|---|---|---|
| `wilayas` | `code` (unique, e.g. 24), `name_ar`, `name_fr` | 58 ولاية |
| `schools` | `wilaya_id`, `workspace_id` (nullable), `name`, `type` (LYCEE/CEM/PRIVATE/OTHER), `address` | المدارس العامة `workspace_id NULL`، والخاصة بمساحة أستاذ |
| `academic_years` | `label` (2025/2026), `starts_on`, `ends_on`, `is_current` | |
| `levels` | `code` (1AS/2AS/3AS), `name_ar`, `order` | |
| `streams` | `code` (SCI/MATH/LIT/LANG/TM/GE/EC), `name_ar`, `level_id` (nullable) | الشعب |

### الأفواج والتسجيل

| جدول | الأعمدة | القيود |
|---|---|---|
| `groups` | `workspace_id`, `teacher_id`, `name`, `wilaya_id`, `school_id`, `level_id`, `stream_id`, `academic_year_id`, `day_of_week` (0-6), `start_time` (time), `duration_minutes`, `room`, `capacity`, `starts_on`, `ends_on`, `status` (ACTIVE/PAUSED/COMPLETED/ARCHIVED), `late_after_minutes` (default 10), `max_unexcused_absences` (default 4), `deleted_at` | idx (workspace_id, status) |
| `group_students` | `group_id`, `student_id`, `workspace_id`, `status` (ACTIVE/SUSPENDED/SUSPENDED_DUE_TO_ABSENCE/INACTIVE/COMPLETED/LEFT_GROUP), `enrolled_at`, `enrolled_via_code_id`, `left_at`, `suspended_at`, `suspension_reason`, `unexcused_absences_count` (cache) | **unique (group_id, student_id)** |
| `student_status_history` | `group_student_id`, `from_status`, `to_status`, `reason`, `changed_by_user_id`, `changed_at` | لا يُحذف أبداً |
| `enrollment_codes` | `workspace_id`, `group_id`, `batch_id`, `code_hash` (unique), `code_prefix` (4 أحرف للعرض), `status` (ACTIVE/USED/DISABLED/EXPIRED), `expires_at`, `used_by_student_id`, `used_at`, `created_by_user_id`, `max_uses` (1) | idx (group_id, status), idx (batch_id) |
| `enrollment_code_batches` | `workspace_id`, `group_id`, `label`, `count`, `created_by_user_id`, `cancelled_at` | إلغاء دفعة كاملة |

### الحصص والحضور

| جدول | الأعمدة | القيود |
|---|---|---|
| `class_sessions` | `workspace_id`, `group_id`, `teacher_id`, `title`, `topic`, `lesson_id` (nullable), `scheduled_at`, `started_at`, `ended_at`, `status` (PLANNED/OPEN/CLOSED/CANCELLED), `attendance_open` bool, `late_after_minutes`, `closed_by_user_id` | idx (group_id, scheduled_at); **partial unique**: حصة OPEN واحدة لكل فوج |
| `attendance_records` | `workspace_id`, `class_session_id`, `group_student_id`, `student_id`, `status` (PRESENT/LATE/ABSENT/EXCUSED/UNEXCUSED), `recorded_at`, `minutes_late`, `source` (SCAN/MANUAL/AUTO_CLOSE), `excuse_reason`, `excuse_notes`, `excuse_file_id`, `excused_by_user_id`, `excused_at`, `scanner_session_id` | **unique (class_session_id, student_id)** |
| `scanner_sessions` | `workspace_id`, `class_session_id`, `teacher_user_id`, `device_label`, `opened_at`, `closed_at`, `scans_count` | |
| `qr_nonces` | `nonce` (PK), `student_id`, `expires_at`, `consumed_at` | Replay protection؛ تُنظّف دورياً |

### المحتوى والملفات

| جدول | الأعمدة |
|---|---|
| `files` | `workspace_id` (nullable), `owner_user_id`, `bucket` (public/private), `storage_key`, `original_name`, `mime_type`, `size_bytes`, `checksum`, `status` (PENDING = تذكرة رفع مباشر لم تكتمل / READY), `deleted_at` |
| `content` | `workspace_id` (nullable = عام), `author_user_id`, `type` (ARTICLE/LESSON/PDF/VIDEO/AUDIO/QUIZ/EXERCISE/IMAGE/LINK), `title`, `slug`, `summary`, `body` (markdown), `file_id`, `external_url`, `video_provider` (YOUTUBE/UPLOAD/NULL), `youtube_id` (11 حرفاً مُتحقَّق منه), `allow_download` (PDF: تنزيل خام أم عرض مختوم فقط)، `level_id`, `stream_id`, `topic`, `skill_id`, `visibility` (PUBLIC/STUDENTS_ONLY/GROUP_ONLY/SPECIFIC_STUDENTS/TEACHERS_ONLY), `published_at`, `deleted_at` |
| `media_views` | `workspace_id`, `content_id`, `file_id`, `user_id`, `student_id`, `viewer_key` (جهاز/تبويب), `ip`, `user_agent`, `started_at`, `last_seen_at`, `seconds_watched`, `max_position`, `completed` | سجل مشاهدة الوسائط المحمية + كشف مشاركة الحساب؛ idx (content_id,user_id), (user_id,last_seen_at) |
| `content_targets` | `content_id`, `group_id` / `student_id` (للرؤية المحددة) |
| `lessons` | = `content` بنوع LESSON + `content_sections` (ترتيب) — مرحلة 4 |

### الواجبات والتقييم (مرحلة 4–6)

`assignments`, `assignment_targets` (group/student), `assignment_submissions` (`answer_text` هو الإجابة المعتمدة للتصحيح — تُكتب نصاً كرسالة؛ `file_id` مرفق داعم اختياري لا يُصحَّح؛ `ocr_text`/`ocr_confirmed` محجوزان وغير مستعملين بقرار عدم اعتماد OCR)، `submission_messages` (سلسلة رسائل الإجابة: `submission_id`, `author_user_id`, `kind` ANSWER/FEEDBACK/REPLY/SYSTEM, `body`, `created_at` — لا تعديل ولا حذف)، قيد فريد `(assignment_id, student_id)` على الإجابات، `quizzes`, `questions` (`type`: MCQ/TRUE_FALSE/SHORT/LONG/FILL_BLANK/MATCHING/IMAGE), `question_options`, `quiz_attempts`, `answers`, `rubrics`, `rubric_items`, `grades` (`score`, `max_score`, `source`: AUTO/AI/TEACHER, `approved_by`), `ai_evaluations` (`submission_id`, `rubric_id`, `provider`, `model`, `status` PENDING/COMPLETED/FAILED, `suggested_score`, `confidence`, `rubric_breakdown jsonb`, `mistakes jsonb`, `strengths`, `weaknesses`, `skills_detected`, `skills_to_improve`, `teacher_notes_suggestion`, `raw_response`, `error` داخلي، `requested_by_user_id` NULL عند التقييم التلقائي، `completed_at`), `teacher_reviews` (`ai_evaluation_id`, `submission_id`, `reviewer_user_id`, `decision`: APPROVED/EDITED/REJECTED, `final_score`, `notes`).

**قاعدة ثابتة:** لا يكتب أي مسار ذكاء اصطناعي في `grades`؛ الصف الوحيد الذي يُنشأ للواجب مصدره `TEACHER` عبر اعتماد الأستاذ. `grades.source = 'AI'` محجوز وغير مستعمل. الحالة الداخلية `AI_EVALUATED` للإجابة تُعرض للطالب كـ `SUBMITTED`.

### المهارات والتتبّع

`skills` (`code`, `name_ar`, `category`), `student_skills` (`student_id`, `skill_id`, `score` 0–100, `confidence`, `attempts`, `last_updated`; unique (student_id, skill_id)), `student_skill_history`, `student_timeline` (`student_id`, `workspace_id`, `type`, `title`, `meta jsonb`, `occurred_at`).

### النظام

| جدول | الأعمدة |
|---|---|
| `notifications` | `user_id`, `workspace_id`, `type`, `title`, `body`, `link`, `read_at`, `meta jsonb` |
| `audit_logs` | `actor_user_id`, `workspace_id`, `action`, `entity_type`, `entity_id`, `old_value jsonb`, `new_value jsonb`, `ip`, `created_at` |
| `activity_logs` | `user_id`, `workspace_id`, `event`, `meta`, `created_at` |
| `jobs` | `type`, `payload jsonb`, `status` (QUEUED/PROCESSING/COMPLETED/FAILED), `attempts`, `run_after`, `result jsonb`, `error` |
| `devices` | = `sessions` (اسم الجهاز + آخر ظهور) |
| `settings` | `key` PK, `value jsonb` (إعدادات المنصة والذكاء الاصطناعي) |

## فهارس وقيود مهمة

- `users(email)` unique; `sessions(token_hash)` unique; `enrollment_codes(code_hash)` unique.
- `group_students(group_id, student_id)` unique — لا تسجيل مزدوج.
- `attendance_records(class_session_id, student_id)` unique — منع التكرار على مستوى القاعدة وليس التطبيق فقط.
- `class_sessions`: فهرس فريد جزئي `(group_id) WHERE status = 'OPEN'` — حصة مفتوحة واحدة لكل فوج.
- فهارس على `workspace_id` في كل جدول مستأجر.

## الحذف

لا حذف فعلي لـ: الطلاب، التسجيلات، الحضور، العلامات، الملفات الدراسية. المغادرة = `status = LEFT_GROUP` + `left_at`. الأفواج والمحتوى: `deleted_at`.
