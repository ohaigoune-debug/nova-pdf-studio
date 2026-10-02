# MADRASADZ EXAM ENGINE — وثيقة التنفيذ

المنظومة الجزائرية الذكية لأرشفة الامتحانات وبناء الفروض والاختبارات. تُبنى **فوق** ما هو قائم في منصة مدرسة، لا بجانبه. هذه الوثيقة هي المرجع: ما هو موجود، ما يُعاد استعماله، ما يُضاف، وبأي ترتيب.

> الفرع: `claude/arabic-edtech-platform-wfcst1` (كل ما بُني هنا مدفوع إليه؛ `main` يبقى النسخة المستقرّة إلى حين الدمج).

## 1. Current architecture (ما هو قائم)

| الطبقة | الواقع |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + Tailwind RTL، مكوّنات `src/components/ui`، صفحات تحت `src/app/(public)`, `/teacher`, `/student`, `/admin`, `/print` |
| Backend | نفس تطبيق Next: Server Actions (`src/server/actions/*`) ← خدمات (`src/server/services/*`) ← Drizzle ORM 0.45 ← PostgreSQL 16 (PGlite في الاختبارات والتطوير) |
| Auth / Roles | جلسات بكوكي موقّع؛ أدوار `SUPER_ADMIN`, `TEACHER`, `ASSISTANT`, `STUDENT`؛ `Actor` يحمل `workspaceId` (مساحة الأستاذ) و`studentId`؛ `requireRole`/`requirePageActor`؛ RLS في `rls.sql` |
| Admin | `/admin/*` (المنهاج والمكتبة، دليل الأساتذة، المتجر، السوق، الذكاء الاصطناعي، التخزين، الأمان، السجلّات، الإعدادات) |
| التخزين | `files` + `storage()` (local أو S3) + روابط موقّعة قصيرة العمر `/api/v1/files/:id?exp&sig`؛ رفع مباشر بتذكرة للكبير |
| PDF | لا pdf-lib للعربية: صفحة طباعة `/print/exams/[id]` (A4 RTL، KaTeX في الخادم، ترويسة رسمية، تصحيح وسلّم، نسخ A–D) + «حفظ كـ PDF» من المتصفّح؛ قراءة نصّ PDF/Word بـ`unpdf`/`mammoth` مع تصحيح ترتيب العربية (`arabic-pdf.ts`) |
| OpenAI / AI | `src/server/ai/*`: مزوّد openai أو anthropic أو mock، المفتاح من `.env` أو من لوحة المشرف (مشفّر في `settings`)، **في الخادم فقط**؛ مخططات JSON صارمة؛ مهام خلفية (`jobs` بمسارين default/slow، تقدّم، سجلّات، إعادة محاولة، أخطاء دائمة)؛ طرق: تصحيح، تحليل، توليد تمارين/اختبارات، تنظيم، `extractQuestions`، `generateExamItems`, `draftFromSource`؛ حدّ معدّل للطلبات؛ سجلّ تدقيق |
| المحتوى التعليمي | `resources` (النموذج الموحّد: نوع، مادة/صف/شعبة/عقدة منهاج، سنة ودورة الامتحان، مصدر وإسناد، ملف/رابط، رسمي/مولّد، حالة، وصول)، `content_sources` (dzexams, youtube, haigoun, madrasadz, onec)، `bac_exams` (أرشيف DzExams الخام)، `curriculum_nodes` (وحدة/فصل/درس/موضوع بفصل وترتيب)، `bank_questions` (بنك الأسئلة بتصنيف كامل، فهرس بحث tsvector، مراجعة، حقوق، مصدر)، `exams`/`exam_items` (الورقة بنسخ مجمّدة)، التدريب الذاتي والتكيّف، المكتبة، المتجر، السوق |
| البحث | tsvector + GIN على `bank_questions` و`resources` (نصّ عربي مطبَّع، «ال» التعريف لا تمنع المطابقة) + ILIKE احتياطاً؛ بحث موحّد في `/library` |
| APIs | Server Actions للواجهة؛ REST تحت `/api/v1` (ملفات، حضور، مصادقة، مهام/Cron) |
| النشر | Docker Compose على Contabo خلف Caddy؛ `bootstrap` يطبّق الهجرات ويزرع المرجعيات عند كل تشغيل |

## 2. What can be reused (لا يُعاد بناؤه)

- **الأرشيف الخام**: `BAC_SYNC` من DzExams (اكتشاف ← جلب ← `bac_exams` ← `resources` EXAM/SOLUTION مع `source_url`, `file_url`, `exam_year`, `exam_session`, الشعبة والمادة، `is_official`). الإذن بإعادة النشر مثبت؛ المصدر محفوظ دائماً في `resources.source_id/source_url/metadata`.
- **التمرين المستقل** = `bank_questions` (النص النظيف `body`، الحلّ، السلّم `bareme`، النقاط، الصعوبة، المدة، المادة/الصف/الشعبة/العقدة/الفصل، نوع الوثيقة `exam_kind`، سنة المصدر وملصقه، `source_resource_id`، الحقوق، الكلمات، الحالة، `content_hash` للتكرار، فهرس بحث، عدّاد الاستعمال). الفرعيات عبر `parent_id`.
- **Taxonomy**: `curriculum_nodes` (شجرة لكل مادة/صف/شعبة، بفصل وترتيب) تُدار من `/admin/curriculum` بلا كود.
- **الاستخراج**: `extractQuestions` (مخطط JSON: تمارين بأسئلتها الفرعية ونقاطها وصعوبتها وموضوعها وكلماتها) + مراجعة `NEEDS_REVIEW` ← اعتماد.
- **المولّد**: `selectFromBank` (حصص صعوبة، زمن، الأقل استعمالاً) + `parseExamRequest` (طلب حرّ ← حقول) + `AI_BUILD_EXAM` (توليد الناقص مشابهاً لأمثلة البنك، موسوم، للمراجعة) + البكالوريا التجريبية بالهيكلة الرسمية.
- **المحرّر (Composer)**: سحب/إفلات، ترتيب، نقاط، فواصل صفحات، نصّ حرّ، تعديل داخل الورقة، مجموع وصعوبة وزمن حيّة، قوالب، سجلّ، إحصاءات.
- **PDF**: صفحة الطباعة (موضوع/تصحيح وسلّم، نسخ A–D، ترويسة المؤسسة والأستاذ والمدة والسنة).
- **المكتبة والبحث العام**، **المتجر والسوق** (نشر الأساتذة، مجاني/مدفوع، نِسب، حقوق).

## 3. What needs to be added (الفجوات) — وما نُفّذ منها

| البند | الحل | الحالة |
|---|---|---|
| سجلّ معالجة لكل وثيقة بحالات `pending/processing/needs_review/published/failed` | جدول `exam_documents` + مهمة `EXAM_DOC_PROCESS` (مسار بطيء) | ✅ المرحلة 1 |
| ربط التمرين بوثيقته ورقمه وأصله (SOURCED / AI_GENERATED / ADAPTED) | أعمدة على `bank_questions`: `origin`, `document_id`, `source_exercise_no`, `source_topic_no`, `ai_confidence`, `skills` | ✅ |
| Pipeline: تنزيل ← تخزين ← نصّ ← (OCR عند الحاجة) ← تقسيم تمارين ← تصنيف ← ربط بالمنهاج ← ربط الحلّ ← تكرار ← مراجعة ← نشر | `exam-engine.service.ts` (`processDocument` / `runProcessDocumentsJob`) | ✅ (OCR مؤجّل: الصفحات المصوّرة تُعلَّم `failed: scanned`) |
| تصنيف الرياضيات 3AS (محاور ودروس بالفصول) | زرع `curriculum_nodes` من `curriculum-nodes-data.ts` (قابل للتعديل من الإدارة) | ✅ |
| «حدّد أين وصلت في البرنامج» والتدرّج يمنع ما بعده | جدول `teacher_progress` + قيد في `selectFromBank` | ✅ |
| فتحات التمارين بالدرس (تمرين 1 دوال، 2 متتاليات…) + صعوبة ونقاط لكل فتحة | `GenerateParams.slots` + واجهة في «ابنِ لي الامتحان» | ✅ |
| AI Mode: طلب طبيعي ← مرشّحات مهيكلة (OpenAI) ثم بحث في البنك | طريقة `parseExamRequest` في المزوّد + احتياط حتمي + ربط المواضيع بالعقد | ✅ |
| «استبدال هذا التمرين» بنفس المعايير | `replaceItem` في الخدمة + زرّ في المحرّر | ✅ |
| أرشيف عام «بنك البكالوريا والاختبارات» بمعاينة داخل الموقع وربط التمارين بالأصل | `/archive` + `/archive/[id]` (PDF المخزَّن محلياً عبر رابط موقّع، أو المصدر) + «عرض الامتحان الأصلي» من صفحة التمرين | ✅ |
| لوحة إدارة المحرّك (أعداد، طابور، فشل، تكرار، اعتماد/رفض/إعادة معالجة) | `/admin/exam-engine` | ✅ (تعديل تصنيف تمرين بعينه ودمج المكرّرات: المرحلة 2) |
| تسجيل استهلاك الذكاء الاصطناعي وتكلفته | جدول `ai_usage_logs` + تسجيل من المزوّدات | ✅ |
| بنية تعليقات Beta للأساتذة | جدول `exam_feedback` (بلا بيانات شخصية زائدة) | ✅ الجدول فقط؛ الخدمة والواجهة في المرحلة 4 |
| بحث دلالي (Embeddings) | مؤجّل: `pgvector` غير متاح في صورة PostgreSQL الحالية؛ البديل الحالي tsvector مطبَّع + تفسير الطلب بالنموذج | المرحلة 3 |
| إعادة بناء نسخة نظيفة بهوية مدرسة من PDF مصدر | الاستخراج ← تمارين نظيفة ← إعادة الإخراج عبر صفحة الطباعة (نصّ/معادلات متّجهية، لا لقطات)؛ الأصل الرسمي يُعرض كما هو مع إسناده | المرحلة 2 (الصور والجداول) |
| توليد تمارين جديدة من أنماط البنك مع تحقّق الحلّ | موجود جزئياً (`AI_BUILD_EXAM` موسوم «راجعه» + نسخة NEEDS_REVIEW)؛ التحقّق الآلي من الحلّ | المرحلة 3 |

## 4. Database migrations

| الهجرة | المحتوى |
|---|---|
| 0013–0020 (قائمة) | البنك، الامتحانات، الورشة، التدريب، التكيّف، فهرس البحث، المتجر، السوق |
| **0021_exam_engine** | `exam_documents`، أعمدة `bank_questions` (origin, document_id, source_exercise_no, source_topic_no, ai_confidence, skills)، `teacher_progress`، `ai_usage_logs`، `exam_feedback`؛ كلها إضافية وبملف تراجع `drizzle/down/0021_exam_engine.down.sql` |

**New entities**
- `exam_documents`: resource_id (الموضوع) ، solution_resource_id، file_id/solution_file_id (نسخة محلية)، status، text_chars، pages، exercises_count، solutions_linked، duplicates، error، ai_model، ai_cost_usd، attempts، processed_at، published_at.
- `teacher_progress`: (workspace, subject, level, stream) ← curriculum_node_id الذي وصل إليه الأستاذ + تاريخ.
- `ai_usage_logs`: purpose، provider، model، input/output tokens، cost_usd، document_id/workspace/user (اختياريان).
- `exam_feedback`: user، exam/question، kind (EXAM_FIT|DIFFICULTY|CLASSIFICATION|SOLUTION|DURATION|REPLACED)، value، note.

## 5. New APIs (Server Actions)

`exam-engine.actions.ts`: `registerBacDocumentsAction`, `processDocumentsAction`, `reprocessDocumentAction`, `approveDocumentAction`, `rejectDocumentAction`.
`exams.actions.ts`: `replaceItemAction`, `setProgressAction`, `listNodesAction`؛ `buildExamAction` يقبل `slots`؛ `parseExamRequestAction` يمرّ بالنموذج ثم الاحتياط الحتمي.
`feedback.actions.ts`: `sendExamFeedbackAction`.

## 6. New pages

- `/archive`, `/archive/[id]` — بنك البكالوريا والاختبارات (عام).
- `/admin/exam-engine` — لوحة المحرّك.
- تعديلات: `/teacher/exams/generate` (أين وصلت، فتحات بالدرس، AI Mode)، `/teacher/exams/[id]` (استبدال)، `/library/q/[id]` (الامتحان الأصلي، الأصل/المولَّد).

## 7. Import pipeline (كما نُفّذ)

```
DzExams (BAC_SYNC) → resources(EXAM/SOLUTION, is_official, source_url, file_url)
   → registerBacDocuments → exam_documents(PENDING)
   → EXAM_DOC_PROCESS (slow lane):
        download PDF → files (نسخة محلية موقّعة) → unpdf text (+ترتيب العربية)
        → قصير جداً؟ ⇒ FAILED (scanned: يحتاج OCR — المرحلة 2)
        → AI extractQuestions (دفعات) → تمارين NEEDS_REVIEW في البنك المركزي
             (origin SOURCED, document_id, رقم التمرين، المادة/الصف/الشعبة/السنة/الدورة، rights LICENSED، المصدر DzExams)
        → تصنيف المنهاج: موضوع النموذج ← عقدة بالمطابقة المطبَّعة + كلمات العقدة (ai_confidence)
        → الحلّ: تنزيل تصحيح الموضوع ← نصّ ← تقطيع بعناوين «التمرين الأول…/Exercice 1» ← ربط برقم التمرين
        → تكرار: content_hash في البنك ← يُتخطّى ويُحصى
        → exam_documents(NEEDS_REVIEW) → المشرف يعتمد (PUBLISHED) أو يرفض
```

## 8. Security changes

- مفاتيح الذكاء الاصطناعي في الخادم فقط (كما كان)؛ لا تمرّ في Server Actions ولا في الواجهة.
- كل إجراء إداري جديد خلف `requireRole('SUPER_ADMIN')`؛ المعرّفات تُتحقّق (UUID) وتُقيَّد بمساحة الأستاذ (`workspaceId`) أو بالمستخدم.
- حدّ معدّل على المعالجة والتوليد (`checkRateLimit`)؛ التنزيل عبر روابط موقّعة قصيرة العمر؛ الملفات المنزَّلة من المصدر تُقبل إن كانت PDF فقط وبحجم أقصى.
- تسجيل استهلاك/تكلفة الذكاء الاصطناعي في `ai_usage_logs`.

## 9. OpenAI architecture

- طبقة واحدة `getAiProvider()` (openai/anthropic/mock) بمخططات JSON صارمة؛ النموذج قابل للتبديل من البيئة أو لوحة المشرف.
- الاستعمال في المحرّك: تقسيم/تصنيف/صعوبة/مهارات/نقاط (`extractQuestions`)، تفسير الطلب الطبيعي (`parseExamRequest`)، توليد الناقص (`generateExamItems`). **البنك أولاً، التوليد ثانياً.**
- التحكّم في التكلفة: نصّ PDF الأصلي قبل أي نموذج؛ لا OCR إلا للمصوّر؛ `cachedText` لنصّ الملف؛ لا تُعالج وثيقة مرّتين (`exam_documents` + `content_hash`)؛ الدفعات؛ تسجيل التكلفة لكل وثيقة.
- قاعدة البيانات هي مصدر الحقيقة: مخرجات النموذج تُحفظ كمقترحات (NEEDS_REVIEW / ai_confidence) ولا تُنشر إلا بالاعتماد.

## 10. PDF architecture

- المصدر الوحيد للحقيقة: HTML + CSS للطباعة (`/print/exams/[id]`) — نصّ متّجهي، KaTeX، RTL/فرنسية، جداول وصور داخل النصّ، ترويسة وتذييل، نسخ A–D، موضوع/تصحيح — ثم «حفظ كـ PDF» من المتصفّح (A4).
- المرحلة 2: خدمة Chromium بلا واجهة لتوليد الملف في الخادم وحفظه في `files`.
- الأصل الرسمي (DzExams) يُعرض كما هو مع إسناده؛ لا يُعاد تأليفه باسم مدرسة.

## 11. Implementation phases

| المرحلة | المحتوى | الحالة |
|---|---|---|
| **1 — PoC رياضيات 3AS بكالوريا** | الهجرة 0021، زرع محاور الرياضيات، سجلّ الوثائق والمهمة، الاستخراج إلى البنك المركزي مع الأصل والحلّ والتصنيف، لوحة `/admin/exam-engine`، أرشيف `/archive`، التدرّج، الفتحات بالدرس، AI Mode، الاستبدال، تسجيل الاستهلاك، اختبارات (`tests/exam-engine.test.ts`) | ✅ منفّذة |
| 2 — تعميم المواد | قوالب محاور الفيزياء والعلوم والعربية والفلسفة؛ OCR للمصوّر؛ صور/جداول التمارين؛ Chromium للـPDF | — |
| 3 — الفروض والاختبارات الفصلية + البحث الدلالي | مصادر إضافية (DzExams devoirs/tests)، pgvector أو embeddings في JSON، تحقّق الحلول المولَّدة | — |
| 4 — Beta الأساتذة | واجهة التعليقات، قياس الاستعمال، تحسين الاختيار من التعليقات | — |

**معيار نجاح المرحلة 1 (سيناريو المستخدم):** `/archive` ← 3AS ← علوم تجريبية ← رياضيات ← فتح بكالوريا بالموضوع والحلّ ← `/teacher/bank` (المركزي) ← رياضيات/3AS/المتتاليات ← تمارين حقيقية ← المحرّر ← مدة وتنقيط ← طباعة الموضوع والتصحيح ← أو «ابنِ لي الامتحان» بالفصل والتدرّج والصعوبة.

**تشغيل المرحلة 1 على الخادم (بعد التحديث):**
1. «الذكاء الاصطناعي» ← مفتاح OpenAI محفوظ.
2. «المنهاج والمكتبة» ← جلب DzExams (إن لم يُجلب بعد) — يملأ `resources` بمواضيع البكالوريا الرسمية وروابطها.
3. «محرّك الامتحانات» ← **تسجيل بكالوريات الرياضيات 3AS** ← **معالجة المعلّق** (20 وثيقة في الدفعة، في الخلفية، بالمسار البطيء) ← لكل وثيقة «بانتظار المراجعة»: افتحها من الأرشيف لتفحص تمارينها ← **اعتماد**.
4. المواضيع المصوّرة (بلا نصّ) تظهر «فشلت: scanned» حتى تُضاف OCR في المرحلة 2.
