# هندسة المنصة — Architecture

> منصة تعليمية عربية (Arabic-first) لتعليم اللغة والأدب العربي لطلبة الثانوي والبكالوريا، مع إدارة الأفواج، الحضور الذكي بـ QR، الواجبات، التصحيح بمساعدة الذكاء الاصطناعي، وتتبّع تطوّر الطالب. نظام SaaS متعدد الأساتذة (Multi-Tenant).

---

## 1. تحليل المشروع الحالي في المستودع

المستودع `nova-pdf-studio` يحتوي على تطبيق مكتبي **Electron** (محرر PDF + فواتير + جداول + OCR محلي) في الجذر (`src/`, `electron.vite.config.ts`, `electron-builder.yml`).

| البند | الوضع | القرار |
|---|---|---|
| المجال الوظيفي | PDF/فواتير/جداول — لا علاقة له بالمنصة التعليمية | لا يُعاد استخدامه وظيفياً |
| التقنية | Electron + React 18 + sql.js (SQLite WASM) + i18next | لا تناسب SaaS ويب متعدد المستأجرين مع Backend مشترك لتطبيقات الجوال |
| ما يُستفاد منه | فلسفة الوحدات (`modules/<name>`)، عقد أنواع واحد بين الطبقات، ترجمات JSON، `AppError` بمفاتيح ترجمة، سجل تدقيق، حذف ناعم | نُطبّق نفس المبادئ في المنصة الجديدة |
| ما يُحفظ | **كل شيء** — لم يُحذف أو يُعدّل أي ملف من التطبيق المكتبي | المنصة تُبنى في مجلد مستقل `platform/` بحزمه واختباراته الخاصة |

**السبب**: التطبيق المكتبي يعمل ومنشور (Release Notes + Landing page). وضع تطبيق Next.js في نفس `package.json` سيكسر `electron-vite` و`tsconfig` الحالية. المجلد المستقل يحافظ على المشروعين معاً في مستودع واحد ويمكن لاحقاً تحويله إلى Monorepo (pnpm workspaces) دون إعادة كتابة.

---

## 2. الـStack المعتمد

| الطبقة | الاختيار | لماذا |
|---|---|---|
| إطار الويب | **Next.js 15 (App Router) + React 19 + TypeScript strict** | SSR/RSC، Server Actions، Route Handlers لواجهة API واحدة تخدم الويب والجوال لاحقاً |
| التنسيق | **Tailwind CSS 3.4 + مكوّنات بأسلوب shadcn/ui** (Radix primitives) | RTL كامل عبر `dir="rtl"` و Logical Properties (`ms-`, `me-`, `ps-`, `pe-`)، Dark Mode عبر `next-themes` |
| قاعدة البيانات | **PostgreSQL** عبر **Drizzle ORM** | Schema بالكود، Migrations مولّدة، أنواع صارمة، لا قفل مع مزود واحد |
| تشغيل محلي/اختبارات | **PGlite** (PostgreSQL مضمّن بـ WASM) | نفس SQL الإنتاج بلا خادم؛ الاختبارات تعمل على قاعدة حقيقية في الذاكرة |
| الإنتاج | `pg` (node-postgres) → أي PostgreSQL: Supabase / Neon / RDS / خادم ذاتي | يُختار عبر `DATABASE_URL` فقط |
| المصادقة | **جلسات مخزّنة في قاعدة البيانات** + كوكي `httpOnly` + تشفير كلمة السر بـ `scrypt` (Node crypto) | لا اعتماد على مزود؛ إدارة الأجهزة/الجلسات وإنهاؤها من الخادم؛ قابلة للاستبدال بـ Supabase Auth عبر `auth/` فقط |
| التحقق | **Zod** في كل Server Action وكل Route Handler | لا يصل إلى الخدمات أي مدخل غير محقّق |
| الرسوم | **Recharts** | Client Components فقط |
| QR | `qrcode` لتوليد الصورة + Token موقّع بـ HMAC-SHA256 | لا بيانات شخصية في الرمز |
| الذكاء الاصطناعي | `AIProvider` (واجهة مجرّدة) + مزوّد تجريبي | المرحلة 6 — لا يرتبط النظام بنموذج واحد |
| الاختبارات | **Vitest** على PGlite | اختبارات تكامل حقيقية للقواعد التجارية |
| المهام الخلفية | جدول `jobs` (QUEUED/PROCESSING/COMPLETED/FAILED) + Worker داخلي | يُستبدل لاحقاً بـ Queue خارجي (pg-boss/BullMQ) بنفس الواجهة |

---

## 3. الطبقات (Clean-ish Architecture)

```
┌──────────────────────────────────────────────────────────────┐
│  UI  (app/**)  Server Components + Client Components         │
│      يقرأ عبر  server/queries/*   ويكتب عبر  server/actions/* │
├──────────────────────────────────────────────────────────────┤
│  Actions / API  (server/actions/*, app/api/v1/**)            │
│      zod validation → requireUser/requireRole → service      │
├──────────────────────────────────────────────────────────────┤
│  Services  (server/services/*)  قواعد العمل + Transactions    │
│      كل خدمة تأخذ  Actor  و  TenantContext  إجبارياً          │
├──────────────────────────────────────────────────────────────┤
│  Data  (server/db/*)  Drizzle schema + migrations + client    │
└──────────────────────────────────────────────────────────────┘
```

قواعد صارمة:

1. **لا استعلام في مكوّن UI**. كل قراءة تمرّ من `server/queries` وكل كتابة من `server/actions` أو `app/api`.
2. **كل خدمة تستقبل `Actor`** (`{ userId, role, workspaceId? }`) وتتحقق من الصلاحية داخلها — الحماية في الخادم لا في الواجهة.
3. **العزل بين الأساتذة على مستوى البيانات**: كل جدول خاص بأستاذ يحمل `workspace_id`؛ كل استعلام في الخدمات يُفلتر به. الـSuper Admin يمرّ بـ `workspaceId = null` مع دور `SUPER_ADMIN` صريح. ملف `db/rls.sql` يحتوي سياسات Row Level Security للتفعيل على PostgreSQL/Supabase كطبقة دفاع ثانية.
4. **الأخطاء**: الخدمات ترمي `AppError(code)`; الواجهة تعرض `t(errors.<code>)` بالعربية. لا Stack traces ولا أخطاء SQL للمستخدم.
5. **الـAPI للجوال** (`/api/v1/**`) يستدعي **نفس الخدمات** — لا تكرار منطق.
6. **الترجمة**: لا نصوص ثابتة في المكوّنات؛ كل نص من `i18n/ar.ts` (+ `fr.ts`, `en.ts` لاحقاً) عبر `t()`.

---

## 4. هيكل المجلدات

```
platform/
  docs/                        ARCHITECTURE, DATABASE_SCHEMA, PERMISSIONS, IMPLEMENTATION_PLAN, SECURITY
  drizzle/                     Migrations مولّدة (SQL) + meta
  src/
    app/
      (public)/                /  /lessons  /bac  /resources  /quizzes  /login  /register  /activate-code
      student/                 لوحة الطالب وصفحاته
      teacher/                 لوحة الأستاذ وصفحاته (groups, students, sessions, scanner, codes, ...)
      admin/                   لوحة الـSuper Admin
      api/v1/                  Route Handlers (auth, attendance token, scanner, ...)
      layout.tsx  globals.css
    components/
      ui/                      Button, Card, Input, Badge, Dialog, Table, Tabs, Progress, ...
      layout/                  AppShell, Sidebar, TopBar, ThemeToggle, NavItems
      domain/                  مكوّنات المجال: StudentQrCard, ScannerConsole, AttendanceTable, ...
    i18n/                      ar.ts (المصدر), types, t()
    lib/                       utils (cn, dates, formatting), constants
    server/
      auth/                    password.ts, session.ts, current-user.ts, guards.ts
      db/                      schema/*.ts, client.ts, migrate.ts, seed.ts, rls.sql
      services/                workspaces, groups, enrollment-codes, class-sessions, attendance, qr-tokens, students, notifications, audit, timeline, jobs, reference
      queries/                 قراءات للوحات (dashboard stats) — read-only
      actions/                 Server Actions (zod → guard → service)
      lib/                     errors.ts, actor.ts, ids.ts, result.ts
      ai/                      provider.ts (واجهة) + mock.ts  (المرحلة 6)
  tests/                       اختبارات تكامل على PGlite
```

---

## 5. تدفّق الحضور الذكي (Vertical Slice)

```
Admin  ─▶ ينشئ أستاذاً  ─▶  teacher_workspaces + users(role=TEACHER)
Teacher ─▶ ينشئ فوجاً ─▶ يولّد أكواداً (enrollment_codes, hash + prefix)
Student ─▶ يسجّل حساباً ─▶ يدخل الكود ─▶ redeemCode():
            تحقق (موجود، غير مستعمل، غير منتهٍ، غير معطّل، الفوج نشط، مقعد متاح)
            → group_students(status=ACTIVE) → code.used_by → timeline + notification + audit
Teacher ─▶ "بدء الحصة" ─▶ class_sessions(status=OPEN, attendance_open=true)
Student ─▶ "بطاقة الحضور" ─▶ /api/v1/student/attendance-token → HMAC token (60s)
            payload = {sid, gid, iat, exp, nonce}  (لا اسم/هاتف)
Teacher ─▶ Scanner Mode ─▶ قارئ USB/BT يكتب الرمز + Enter ─▶ scanAttendance():
            verify signature → exp → nonce غير مستعمل (qr_nonces) → الجلسة OPEN →
            الطالب ACTIVE في نفس الفوج → لا سجل سابق → PRESENT/LATE حسب late_after_minutes
            → attendance_records + timeline + audit  → ردّ فوري بالعربية
Teacher ─▶ "إنهاء الحصة" ─▶ closeSession()  [Transaction]:
            status=CLOSED, attendance_open=false → كل ACTIVE بلا سجل ⇒ UNEXCUSED
            → إعادة حساب الإحصائيات → قاعدة 4 غيابات ⇒ SUSPENDED_DUE_TO_ABSENCE
            → student_status_history + notifications + timeline + audit
Teacher ─▶ يبرّر غياباً (EXCUSED + reason) ─▶ يعيد الحساب، لا يعيد التفعيل تلقائياً
Teacher ─▶ "إعادة تفعيل الطالب" ─▶ ACTIVE + history + audit
```

---

## 6. قرارات مهمة وموثّقة

| القرار | البديل المرفوض | السبب |
|---|---|---|
| مصادقة ذاتية بجلسات DB | Supabase Auth فقط | حرية الاستضافة، إدارة أجهزة/جلسات، اختبار بلا شبكة. يمكن ربط Supabase Auth لاحقاً عبر `server/auth` فقط |
| الأكواد تُخزَّن كـ `code_hash` مع `code_prefix` للعرض | تخزين الكود صريحاً | تسرّب قاعدة البيانات لا يعطي أكواداً صالحة؛ الأستاذ يحصل على الكود الصريح **مرة واحدة** عند التوليد (ويُطبع/يُصدَّر حينها) |
| QR = HMAC token قصير العمر + nonce مستهلك | JWT طويل / Student ID ثابت | منع إعادة الاستعمال والتصوير |
| PGlite للتطوير والاختبار | تثبيت Postgres محلي | تشغيل فوري لأي مطوّر؛ نفس SQL؛ الإنتاج يبقى Postgres حقيقياً |
| `status` نصي بقيود CHECK بدل Postgres ENUM | ENUM | إضافة قيمة (نوع طالب جديد) = Migration بسيط بلا قفل جداول |
| المهام الثقيلة عبر `jobs` | استدعاء مباشر | لا يعلّق AI الصفحة؛ سهولة استبدال الـWorker |

---

## 7. الجاهزية للمستقبل (لا تُبنى الآن)

- **الاشتراكات/الدفع**: `teacher_workspaces.plan` + جدول `subscriptions` لاحقاً؛ لا منطق فوترة الآن.
- **ولي الأمر**: دور `PARENT` محجوز في `roles`، وجدول `guardian_links` لاحقاً.
- **الجوال**: كل الميزات مكشوفة عبر `/api/v1` بنفس الجلسة (Bearer token من نفس جدول `sessions`).
- **الدردشة/الحصص المباشرة/الشهادات**: وحدات مستقلة تعتمد على `workspace_id` و`group_id`.
