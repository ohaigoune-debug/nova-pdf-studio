# مدرسة (Madrasadz) — الإصدار الثاني: المكتبة الوطنية + بنك الأسئلة + أكاديمية حيقون

> تقرير PHASE 0: تحليل المنصة القائمة، والهندسة المستهدفة، وخطة الهجرة، وخطة التنفيذ مرحلةً مرحلة.
> المبدأ: **نوسّع ولا نعيد البناء**. لا حذف لوظيفة ولا لجدول ولا لمسار قائم.

---

## 1. الوضع الحالي (ما هو موجود ويعمل في الإنتاج)

### 1.1 التقنية

| الطبقة | القائم | الحكم |
|---|---|---|
| الإطار | Next.js 15.5 (App Router، Server Actions، RSC) + React 19 + TypeScript strict | يُبنى عليه كما هو |
| الواجهة | Tailwind 3.4 + مكوّنات shadcn/Radix + خطوط محلية (Amiri، IBM Plex Arabic، Aref Ruqaa) + RTL كامل + Dark Mode | يُعاد استعمال نظام التصميم كله |
| قاعدة البيانات | PostgreSQL 16 (Docker) عبر Drizzle ORM 0.45؛ PGlite في التطوير والاختبارات | يُبنى عليه؛ الهجرات بـ drizzle-kit |
| المهام الخلفية | جدول `jobs` + عامل داخلي (inline worker) + إعادة محاولة بتراجع أُسّي + أخطاء نهائية (PermanentJobError) | يُوسَّع (تقدّم، عدّادات، سجلّات) |
| التخزين | محلي أو S3 (رفع مباشر بتذاكر موقّعة، روابط تنزيل موقّعة) | كما هو |
| الذكاء الاصطناعي | طبقة مزوّدين (`AIProvider`): OpenAI، Anthropic، Mock؛ مخطّطات JSON صارمة؛ دفعات (Batch) | تُوسَّع إلى AI Service Layer مع سجلّ استهلاك وتكلفة وذاكرة مؤقتة |
| المصادقة | جلسات قاعدة بيانات (رمز عشوائي، مجزّأ SHA-256 في `sessions`)، كوكي httpOnly، أدوار: SUPER_ADMIN، TEACHER، ASSISTANT، STUDENT، PARENT | **لا تغيير** |
| التعدّد | مساحة عمل لكل أستاذ (`teacher_workspaces`)، وكل بيانات الأفواج مقيّدة بها؛ ملف RLS لـ PostgreSQL | يُحفظ؛ المكتبة العامة خارج المساحات |
| الأمان | CSP بـ nonce، حدّ محاولات في DB، تدقيق (`audit_logs`)، سجلّ نشاط، حذف ناعم، تحقّق zod في كل Action | يُحفظ ويُعمَّم على الوحدات الجديدة |
| التطبيق | PWA + غلاف Android (TWA) منشور، Web Push | كما هو |
| الاختبارات | Vitest على PGlite حقيقي: 43 ملفاً، 180 اختباراً | كل مرحلة تضيف اختباراتها |

### 1.2 قاعدة البيانات (57 جدولاً، 10 هجرات)

| المجال | الجداول |
|---|---|
| الهوية | `users`، `profiles`، `sessions`، `password_resets`، `rate_limits` |
| التعدّد والأساتذة | `teacher_workspaces`، `teachers`، `assistants`، `assistant_codes`… |
| المرجع | `wilayas`، `schools`، `academic_years`، **`levels`** (1AS–3AS فقط)، **`streams`** (8 شعب ثانوية) |
| التلاميذ والأفواج | `students`، `groups`، `group_students`، `enrollment_codes`، `student_status_history` |
| الحضور | `class_sessions`، `attendance_records`، رموز QR ديناميكية |
| المحتوى (الأكاديمية) | `content` (دروس الأستاذ: مقال، PDF، فيديو، رابط… مع رؤية وأفواج)، `content_targets`، `files`، `media_views` |
| التقويم | `assignments` (+ الحل النموذجي)، `assignment_submissions`، `messages`، `quizzes`، `questions`، `quiz_attempts`، `answers`، `grades`، `rubrics`، `rubric_items` |
| الذكاء الاصطناعي | `ai_evaluations`، `teacher_reviews`، `jobs` |
| المهارات | `skills` (12 مهارة عامة بلا مادة)، `student_skills`، `student_skill_history` |
| التواصل | `notifications`، `push_subscriptions`، `announcements`، `class_posts`، `class_comments` |
| الأرشيف | `bac_exams` (روابط DzExams — جدول مستقل مؤقت) |

### 1.3 المسارات
حوالي 100 صفحة: عامة (`/`، `/lessons`، `/bac`، `/past-bac`، `/resources`، `/quizzes`…)، `/student/*`، `/teacher/*`، `/assistant/*`، `/admin/*`، وواجهة `/api/v1/*` (حضور، ملفات، مهام، وسائط).

### 1.4 ما يُعاد استعماله كما هو
المصادقة والأدوار، الأفواج والحضور بـ QR، الواجبات والتصحيح بـ«نعم/لا/تعديل»، الاختبارات ومحرّك تصحيحها الآلي (`quiz-grading`)، تتبّع المهارات (`student_skills`)، الإشعارات والقسم الافتراضي، استخراج النصوص (PDF مع إصلاح الترتيب العربي، Word، PowerPoint)، قراءة Google Drive، مستورد يوتيوب، طبقة الذكاء الاصطناعي، نظام التصميم.

### 1.5 الدَّين التقني المكتشف

| # | المشكلة | الأثر | العلاج (المرحلة) |
|---|---|---|---|
| 1 | المستويات ثانوية فقط، والمواد نصوص حرّة (`teachers.subject`، `assignments.subject`، `content.topic`) | لا تصنيف موحّد ولا ابتدائي/متوسط | تصنيف المنهاج بمعرّفات (1) |
| 2 | `skills` بلا مادة ولا درس | لا تعلّم تكيّفي دقيق | ربط المهارة بالمادة وعقدة المنهاج (1، 7) |
| 3 | `bac_exams` جدول منعزل | ازدواج نماذج | نقله إلى النموذج الموحّد بلا حذف (1، 2) |
| 4 | البحث `ILIKE` على الأسماء فقط | بطيء ولا يشمل المحتوى | فهرس نصّي كامل + ترتيب دلالي (4، 6) |
| 5 | المهام بلا تقدّم ولا عدّادات ولا سجلّات | لا واجهة متابعة للاستيراد الكبير | توسيع `jobs` (2) |
| 6 | استدعاءات الذكاء الاصطناعي بلا سجلّ استهلاك ولا ميزانية ولا ذاكرة مؤقتة | تكلفة غير مضبوطة | `ai_usage_logs` + ميزانيات + Cache (6، 9) |
| 7 | تحليل التلميذ يرسل اسمه إلى النموذج | خصوصية | معرّف مجهول (6) |
| 8 | تصنيفات تعليمية مكتوبة يدوياً في عدّة ملفات | صيانة صعبة | مصدر واحد: جداول المرجع (1) |
| 9 | Postgres بلا pgvector | لا بحث دلالي | صورة `pgvector/pgvector:pg16` (نفس الإصدار الرئيسي، بلا نقل بيانات) (6) |

---

## 2. الهندسة المستهدفة

```
                 ┌─────────────────────── الواجهات (Next.js RSC، RTL) ───────────────────────┐
                 │  المكتبة · BAC DZ · BEM · مركز المادة · الأساتذة · الفيديوهات · مولّد الاختبارات │
                 │  أكاديمية حيقون (القائمة) · لوحة الإدارة / Content Engine                     │
                 └───────────────────────────────┬──────────────────────────────────────────────┘
                                                 │ Server Actions / Route Handlers (تحقّق zod + RBAC)
┌────────────────────────────────────────────────┴────────────────────────────────────────────────┐
│ خدمات المجال (src/server/services)                                                              │
│  taxonomy · resources · import (dzexams, pdf, youtube) · questions · dedup · search · generator │
│  grading · adaptive · academy (القائم: groups, attendance, assignments, quizzes, classroom)       │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ AI Service Layer: AIService (سجلّ الاستهلاك، التكلفة، الميزانية، Cache) ← مزوّدون: OpenAI/…       │
│   ContentClassifier · QuestionGenerator · AnswerEvaluator · Embedding · Recommendation           │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Jobs: jobs(+progress/logs) · عامل داخلي · Rate limits خارجية (YouTube quota، OpenAI، المصادر)     │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ PostgreSQL: علائقي أولاً (فلاتر بمعرّفات) · tsvector للبحث · pgvector للترتيب الدلالي فقط          │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 تصنيف المنهاج (Curriculum Taxonomy) — معرّفات لا نصوص

```
education_stages (PRIMARY | MIDDLE | SECONDARY)
   └─ levels  ← «الصفوف» (1AP…5AP، 1AM…4AM، 1AS…3AS) — الجدول القائم، يُضاف له stage_id
        └─ grade_streams ← أيّ الشعب في أيّ صف (1AS: جذعان؛ 2AS/3AS: ست شعب)
              streams ← الجدول القائم، يُضاف parent_id (خيارات تقني رياضي)
subjects ← جديد (slug للروابط: math، arabic، physics…)
subject_offerings (level × stream? × subject × curriculum_version) ← المادة المقرّرة، مادة امتحان أم لا
curriculum_versions ← «منهاج 2016» … لعدم خلط برنامج قديم بجديد
curriculum_nodes ← شجرة واحدة: UNIT → CHAPTER → LESSON → TOPIC (parent_id، kind، ترتيب، فصل دراسي)
skills ← القائم، يُضاف subject_id و curriculum_node_id
```

**لماذا شجرة واحدة للوحدات والفصول والدروس والمواضيع؟** لأن المنهاج الجزائري لا يتّسق عمقه بين المواد (الرياضيات: وحدة ← درس؛ العربية: محور ← نص ← ظاهرة). جدول واحد بنوع العقدة يحفظ العلاقات دون أعمدة فارغة ودون أربع جداول تتكرّر فيها نفس الحقول.

### 2.2 النموذج الموحّد للمحتوى

```
content_sources (DZEXAMS | YOUTUBE | HAIGOUN | MADRASADZ | OFFICIAL_EXAM | OTHER) + الإسناد الظاهر للمستخدم
resources ← كل مورد في المكتبة: درس، ملخّص، تمرين، فرض، اختبار، امتحان رسمي، حل، فيديو، وثيقة بيداغوجية
   • التصنيف: stage، level، stream، subject، curriculum_node (أدقّ عقدة)، school_term، academic_year، exam_year، exam_session
   • المصدر: source_id، source_url، source_ref، original_author
   • الوسائط: file_id (ملف عندنا) أو file_url (رابط)، thumbnail_url، youtube_video_id، youtube_channel_id
   • الحلّ: has_solution، solution_resource_id (مورد آخر)
   • الصدقية: is_official، is_ai_generated — قيد في القاعدة: لا يجتمعان
   • الوصول: access_level (PUBLIC، REGISTERED، STUDENTS، GROUP، PREMIUM) + workspace_id + content_id (ربط بمحتوى الأكاديمية القائم)
   • الحالة: DRAFT، NEEDS_REVIEW، PUBLISHED، ARCHIVED، BROKEN
   • منع التكرار: fingerprint فريد (المصدر + المعرّف الخارجي أو الرابط)، content_hash للمحتوى نفسه
resource_groups ← قصر مورد على أفواج
```

`content` (دروس الأكاديمية الحالية) **لا يُلغى**: يبقى محرّك الأكاديمية (الأفواج والرؤية والإشعارات)، ويُربط بالمكتبة عبر `resources.content_id` حين يُنشر عاماً.

### 2.3 بنك الأسئلة (PHASE 3)
`source_documents` (PDF/صفحة مع النص الأصلي والمستخرج والتقسيم) ← `bank_questions` (النص الأصلي + المنظّم + HTML، النوع، التصنيف بالمعرّفات، السنة والدورة، الصفحة الأصلية، النقاط، الوقت، الرسمي/المولّد، حالة التحقّق، الثقة، ثلاث بصمات: نص مطابق، نص مُطبَّع، تضمين) ← `question_solutions`، `question_sources` (مصادر متعدّدة لسؤال واحد بدل نسخه)، `question_skills`، `question_usage`، `question_attempts`. قائمة المراجعة للعناصر المشكوك فيها.

> لا يُمسّ جدول `questions` القائم (أسئلة اختبارات الأساتذة)؛ اختبار يُبنى من البنك يُنشئ `quiz` و`questions` عادية مع مرجع `bank_question_id`، فيعمل محرّك التصحيح الحالي كما هو.

### 2.4 مولّد الاختبارات و RAG (PHASE 6)
```
طلب التلميذ ← فلاتر علائقية (مستوى، شعبة، مادة، عقدة، صعوبة) ← بحث نصّي ← ترتيب دلالي (pgvector) عند الحاجة
   ← أسئلة وحلول حقيقية (Mode 1/2) ← أو سياق محدود إلى OpenAI (Mode 3) ← تحقّق ← نتيجة
```
Mode 3 يحمل دائماً `is_ai_generated=true` ووسم «سؤال مولّد بالذكاء الاصطناعي»، والقاعدة تمنع `is_official=true` معه.

### 2.5 التصحيح
اختيار من متعدّد وصح/خطأ وإكمال: آلي بلا ذكاء اصطناعي (القائم). عددي: تحقّق حتمي بتسامح. مفتوح: شبكة تنقيط + الحل المخزّن مرجعاً أول، والذكاء الاصطناعي يشرح ويحلّل ولا يستبدل الحل الرسمي.

### 2.6 الأكاديمية
القائم كلّه (أفواج، حضور QR، واجبات، اختبارات، قسم افتراضي، إشعارات، تقدّم) يُجمع تحت «أكاديمية الأستاذ حيقون» مع مصدر `HAIGOUN` ومستويات وصول.

### 2.7 الأداء والسعة
فهارس مركّبة على (subject، level، stream، type، status)، ترقيم بالمؤشّر (cursor) في القوائم الكبيرة، tsvector مولّد + GIN، pgvector بفهرس HNSW، لا مجموعات ضخمة نحو الواجهة، RSC مع تخزين مؤقت للصفحات العامة، صفحات SEO ثابتة المسارات.

---

## 3. خطة الهجرة (Migration Plan)

القواعد: كل هجرة **إضافية** (جداول وأعمدة nullable وفهارس)، لا `DROP` ولا إعادة تسمية لجدول مستعمل، والبيانات الحالية تبقى. لكل هجرة ملف تراجع في `drizzle/down/`.

| # | الهجرة | المحتوى | البيانات |
|---|---|---|---|
| 0010 | `curriculum_taxonomy` | `education_stages`، `subjects`، `grade_streams`، `subject_offerings`، `curriculum_versions`، `curriculum_nodes`، أعمدة `levels.stage_id`، `streams.parent_id`، `skills.subject_id`، `skills.curriculum_node_id` | بذرة مرجعية idempotent عند كل bootstrap: المراحل، الصفوف 1AP…3AS، الشعب وخيارات التقني، المواد، مواد البكالوريا لكل شعبة ومواد BEM |
| 0010 | `unified_content` | `content_sources`، `resources`، `resource_groups` | ملء `resources` من `bac_exams` (بصمة ⇒ بلا تكرار) |
| 0011 | `jobs_progress` | أعمدة `progress`، `total_items`، `processed_items`، `failed_items`، `logs` في `jobs` | — |
| 0012 | `question_bank` | `source_documents`، `bank_questions`، `question_solutions`، `question_sources`، `question_skills`، `question_usage`، `question_attempts`، `review_queue` | — |
| 0013 | `search_index` | tsvector مولّد + GIN على `resources` و`bank_questions` | إعادة البناء بمهمة |
| 0014 | `youtube_directory` | `educators`، `youtube_channels`، `youtube_playlists`، `youtube_videos`، `educator_subjects`، `educator_levels` | — |
| 0015 | `ai_layer` | `ai_usage_logs`، `ai_cache`، `ai_budgets`، `embeddings` (pgvector) | تفعيل pgvector بعد تبديل الصورة |
| 0016 | `adaptive` | `student_skill_progress` (توسيع `student_skills` بمعرّف المادة والعقدة) | نقل آمن من القائم |

---

## 4. خطة التنفيذ

| المرحلة | التسليم | معيار الإنجاز |
|---|---|---|
| **0** | هذا التقرير | — |
| **1** ✅ | التصنيف + النموذج الموحّد + الهجرة + البذرة + ملء `resources` من `bac_exams` + خدمات التصنيف والموارد + صفحة إدارة «المنهاج» تعمل فعلاً | اختبارات: عدم التكرار، القيود، الملء — وجُرّبت الترقية على نسخة من قاعدة قائمة (لم يضع شيء) والتراجع كذلك |
| **2** | خطّ استيراد DZExams: DISCOVER→FETCH→PARSE→EXTRACT→CLASSIFY→NORMALIZE→DEDUPLICATE→STORE→INDEX→REVIEW، مهام بتقدّم وسجلّات، أرشيف BAC/BEM | تشغيلان متتاليان = نفس العدد |
| **3** | استخراج الأسئلة من PDF (محلّلات أولاً، ذكاء اصطناعي للتصنيف)، الحلول، منع التكرار، قائمة المراجعة | لا سؤال مكرّر؛ كل سؤال بصفحته ومصدره |
| **4** | البحث الشامل، مراكز المواد، صفحات BAC DZ / BEM بمسارات SEO، التنقّل «ثلاث نقرات» | |
| **5** | دليل أساتذة الجزائر: اكتشاف القنوات، الاعتماد، المزامنة التزايدية، تصنيف الفيديوهات | |
| **6** | مولّد الاختبارات (3 أوضاع)، RAG، طبقة الذكاء الاصطناعي بالسجلّ والتكلفة والميزانية والـCache، التحقّق من الأسئلة المولّدة | |
| **7** | التصحيح الموسّع (عددي، شبكات)، تقدّم المهارات، التوصيات، «اختبرني كما في الباك» | |
| **8** | أكاديمية حيقون: تجميع القائم تحت قسم واحد، مصدر HAIGOUN ومستويات الوصول | |
| **9** | Content Engine: الإحصاءات، الأدوات، طوابير المهام، التكاليف، المراقبة | |

كل مرحلة: هجرة إضافية + خدمات مختبَرة + واجهة موصولة ببيانات حقيقية + commit مستقل، دون كسر مسار قائم.

---

## 5. التراجع (Rollback)

كل هجرة من الإصدار الثاني لها ملف في `drizzle/down/`. قبل أي تراجع: نسخة احتياطية (`scripts/backup.sh`).

```
docker compose -f docker-compose.prod.yml exec -T db psql -U madrasa madrasa < drizzle/down/0010_library_taxonomy.down.sql
```

التراجع يزيل الجداول والأعمدة الجديدة فقط. صفوف الصفوف والشعب المضافة (1AP…4AM وخيارات تقني رياضي) تبقى في جدولَي `levels` و`streams` لأنها قد تكون مستعملة في أفواج أو تلاميذ، ولا تضرّ الإصدار السابق.
