# MADRASADZ PLAY — الخطة التقنية

> العب، تعلّم، أتقن. — قسم الألعاب التعليمية في منصة «مدرسة» (madrasadz.com)

## 1. التقرير التقني للبنية المكتشفة (Milestone 1)

| البند | الواقع في المستودع |
|---|---|
| المشروع | `platform/` داخل `nova-pdf-studio` — **Next.js 15 (App Router) + React 19 + TypeScript strict** |
| قاعدة البيانات | **PostgreSQL** عبر **Drizzle ORM**؛ محلياً واختبارات **PGlite** (`DATABASE_URL=pglite://memory`) |
| الهجرات | `drizzle/*.sql` مولّدة بـ `drizzle-kit generate`؛ تُطبَّق عند الإقلاع إذا `AUTO_MIGRATE=1` (الاستضافة المُدارة تفعّلها في `scripts/start-hosted.sh`) |
| المصادقة | جلسات في DB + كوكي httpOnly؛ `requirePageActor(role)` للصفحات و`requireRole` للـServer Actions؛ `Actor { userId, role, studentId, workspaceId }` |
| الأدوار | `SUPER_ADMIN`, `TEACHER`, `ASSISTANT`, `STUDENT`, `PUBLIC`, `PARENT` |
| التصنيف الدراسي الموجود | جدولا `levels` (1AS/2AS/3AS فقط) و`streams` (TC_SCI, TC_LIT, SCI, MATH, TM, GE, LIT, LANG)؛ الطالب يحمل `level_id`/`stream_id` اختيارياً. لا توجد مواد ولا وحدات ولا دروس. |
| QCM الحالي | `quizzes` / `questions` / `question_options` / `quiz_attempts` / `answers` — اختبارات يصنعها الأستاذ لأفواجه (أو عامة)، تُصحَّح دفعة واحدة عند التسليم، بلا شرح، بلا تصنيف منهاجي، بلا XP. الواجهة: `quiz-builder.tsx`, `quiz-player.tsx`. |
| بنك الأسئلة الموجود | `content/qcm/*.json` — 988 سؤال QCM في البناء اللغوي (3AS)، مع شرح لكل سؤال، غير مستورد بعد (`src/server/db/import-qcm-bank.ts`) |
| الإعدادات | جدول `settings(key, value jsonb)` — مناسب لقواعد XP القابلة للتعديل |
| الإشعارات/التدقيق | `notifications`, `audit_logs`, `student_timeline` — تُعاد استعمالها |
| واجهة المستخدم | Tailwind + مكوّنات shadcn-like (`components/ui/*`)، RTL كامل، Dark mode، `AppShell` بقائمة جانبية تُعرَّف في `components/layout/nav.ts` |
| الاختبارات | Vitest على PGlite (`tests/*.test.ts`)؛ `npm run typecheck`, `npm run lint` |
| النشر | Render (render.yaml) / Docker / VPS / Vercel — أي دفع إلى `main` قد يُنشر تلقائياً ويطبّق الهجرات ⇒ **كل عمل PLAY على فرع `madrasadz-play`** ويُدمج بعد الموافقة |

### قرار البناء

- **لا نعيد كتابة** QCM الحالي (اختبارات الأساتذة لأفواجهم تبقى كما هي). PLAY **قسم جديد** له جداوله `play_*` وخدماته وواجهته، ويعيد استعمال: المصادقة، `Actor`، `AppError`، `settings`، `notifications`، `audit`، مكوّنات UI، البيانات المرجعية للشعب.
- بنك PLAY **عام على مستوى المنصة** (ليس لكل أستاذ) ويديره `SUPER_ADMIN`.
- الطالب يحتاج حساباً (الدور `STUDENT`)؛ صفحة عامة `/play` تعرّف بالقسم وتدعو للدخول.

## 2. نموذج البيانات (جداول جديدة فقط — لا تعديل على الجداول القائمة)

| الجدول | الدور |
|---|---|
| `play_subjects` | المواد (code, name_ar, name_fr, lang, color, icon, sort) |
| `play_lessons` | خريطة المنهاج: (grade_code, stream_codes[], subject_code, unit_code, unit_name, lesson_code, lesson_name, objective, sort, verified, is_active) |
| `play_questions` | السؤال: key فريد ثابت (idempotent)، النوع، grade/streams/subject/lesson، difficulty، question_text، `payload` (ما يُرسل للمتصفح) + `answer_key` (لا يُرسل أبداً قبل التصحيح)، explanation، tags، language، review_status، quality_flags، source، content_hash، إحصاءات |
| `play_sessions` | جلسة تحدٍّ: نوع التحدي، الأسئلة المختارة بالترتيب، الحالة، المؤقت، النتيجة |
| `play_answers` | إجابة واحدة لكل (session, question) — قيد فريد يمنع التسجيل المزدوج |
| `play_student_stats` | XP الإجمالي، المستوى، السلسلة اليومية، المجاميع، تفضيلات (صوت/حركة) |
| `play_subject_stats` | تقدم الطالب في كل مادة |
| `play_lesson_progress` | إتقان كل درس (نسبة، تاريخ الإتقان) |
| `play_question_memory` | ذاكرة Leitner لكل سؤال/طالب (box, due_at) للمراجعة المتباعدة وتقليل التكرار |
| `play_student_badges` | الشارات المكتسبة |
| `play_question_reports` | بلاغات الطلاب عن أخطاء الأسئلة |
| `settings['play.xp']` | قواعد XP والمستويات (قابلة للتعديل من الإدارة) |

المراحل التعليمية والسنوات والشعب ثوابت في الكود (`src/server/play/catalog.ts`) قابلة للتوسع إلى كل سنوات الابتدائي والمتوسط والثانوي دون هجرة (تخزين نصي).

## 3. أنماط الألعاب

- **GAME 1 MCQ**: 4 اختيارات، إجابة واحدة، ترتيب الخيارات يُخلط على الخادم لكل جلسة (بذرة ثابتة بالجلسة).
- **GAME 2 FILL_BLANK**: `segments` + `blanks` + `bank` منظمة (لا تحليل نصي هش)، فراغ واحد أو أكثر، النقر يملأ، سحب/إفلات حيث يتاح، إعادة الكلمة.
- **GAME 3 MATCHING** و **GAME 4 ORDERING**: نفس المحرك (payload/answer_key) — الواجهة تُضاف بعد إتقان 1 و2.

## 4. حلقة اللعب والأمان

1. `startPlaySession` (خادم): يختار الأسئلة من DB بتوازن الدرس/الصعوبة/النوع، يقلل المتقن (memory box ≥ 4 وغير مستحق)، يعيد الخاطئ المستحق، ويحفظ الجلسة.
2. المتصفح يستلم الأسئلة **بلا مفاتيح إجابة**.
3. `submitPlayAnswer` (خادم): يصحّح، يسجل الإجابة (فريدة)، يحسب XP حسب القواعد، يحدّث الذاكرة والتقدم والشارات، ثم يعيد الإجابة الصحيحة والشرح.
4. لا ثقة بأي حساب نقاط من المتصفح.

## 5. مصنع الأسئلة

- الملفات: `content/play/<grade>/<subject>/<file>.json` (كائنات منظمة بمفتاح `key` ثابت).
- `scripts/play/validate.ts`: فحص بنيوي + كشف تكرار (تطبيع عربي + hash) + تقرير تغطية مقابل `content/play/coverage-map.json`.
- `scripts/play/import.ts`: upsert idempotent بالـ`key` (إعادة التشغيل آمنة)، لا حذف.
- الحالات: `DRAFT → AUTO_VALIDATED | NEEDS_REVIEW → APPROVED → PUBLISHED | REJECTED`. المحرك يقدّم للطالب `AUTO_VALIDATED/APPROVED/PUBLISHED` (قابل للتضييق إلى `PUBLISHED` فقط من الإعدادات). لا اعتماد تلقائي.
- التوزيع المستهدف: 4AM 800 · 1AS 900 · 2AS 1300 · 3AS 2000 = 5000؛ 60% MCQ / 40% ملء فراغ؛ صعوبة 30/45/25.
- التقدم في `MADRASADZ_PLAY_PROGRESS.md` و`content/play/progress.json`.

## 6. المعالم

| # | المعلم | الحالة |
|---|---|---|
| M1 | الفحص التقني والخطة | ✅ |
| M2 | محرك اللعب (مخطط + هجرة + خدمات + واجهة MCQ/ملء الفراغ) | ⏳ |
| M3 | التحفيز (XP، مستويات، شارات، تحديات، عالج أخطاءك) | ⏳ |
| M4 | مصنع الأسئلة (صيغة، مدقق، تكرار، استيراد، خريطة تغطية) | ⏳ |
| M5 | أول 200 سؤال واختبارها | ⏳ |
| M6 | 1000 سؤال مفحوص | ⏳ |
| M7 | 5000 سؤال + تقارير | ⏳ |
| M8 | لوحة الإدارة + QA | ⏳ |
| M9 | جاهزية النشر (PR، توثيق، تراجع) | ⏳ |
