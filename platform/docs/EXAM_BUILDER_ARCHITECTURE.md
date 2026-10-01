# Madrasadz — Exam Builder: التدقيق والهندسة وخارطة الطريق

تاريخ التدقيق: 2026-10-01 · الفرع `claude/arabic-edtech-platform-wfcst1` · آخر commit قبل هذا العمل `84186e1`.
يكمّل هذا المستند `ARCHITECTURE_V2.md` (الإصدار الثاني: التصنيف والمكتبة الموحّدة) ولا يلغيه: الـExam Builder يُبنى **فوق** ما أُنجز هناك.

---

## 1. Current Architecture Audit (تدقيق البنية الحالية)

| الطبقة | الحال |
|---|---|
| إطار العمل | Next.js 15 (App Router، Server Actions)، React 19، TypeScript صارم، Tailwind بدعم RTL كامل |
| قاعدة البيانات | PostgreSQL 16 في الإنتاج (Docker)، PGlite في التطوير والاختبارات؛ Drizzle ORM؛ 12 هجرة (0000…0012) بملفات تراجع من 0010 |
| المصادقة والصلاحيات | جلسات بملفّ تعريف، أدوار `SUPER_ADMIN` / `TEACHER` / `ASSISTANT` / `STUDENT`، كل أستاذ في `teacher_workspace` معزول (كل استعلام يُقيَّد بـ`workspace_id`) |
| المهام الخلفية | جدول `jobs` بعامل داخلي + Cron؛ مساران (افتراضي/بطيء)، تقدّم وسجلّات (0011)، أخطاء دائمة لا تُعاد |
| الذكاء الاصطناعي | واجهة `AIProvider` (OpenAI/Anthropic/mock) بمخططات JSON صارمة؛ المفتاح من اللوحة أو البيئة؛ لا بيانات شخصية تُرسل |
| الملفات | رفع مباشر بتذكرة، تخزين محلي أو S3، استخراج نصّ PDF/Word/PPTX (`doc-text.ts` + ترتيب العربية)، Drive عام بمفتاح API |
| الاختبار الحالي | `quizzes` + `questions` + `question_options` + `quiz_attempts` + `answers`: اختبار إلكتروني يحلّه التلميذ داخل المنصة ويُصحَّح آلياً (MCQ/صح-خطأ/قصير/فراغات/مطابقة) |
| الواجب | `assignments` + `submissions` + شبكات تقييم `rubrics` + تصحيح بالذكاء الاصطناعي يراجعه الأستاذ |
| المكتبة الموحّدة | `resources` (بكالوريات DzExams، فيديوهات دليل الأساتذة)، تصنيف المنهاج `curriculum_nodes`، `subjects`/`levels`/`streams`/`education_stages` |
| الاختبارات الآلية | 46 ملفاً / 206 اختبار، كلها تمرّ |
| PDF | `pdf-lib` للختم المائي فقط؛ **لا مولّد مستندات عربية** (pdf-lib لا يشكّل الحروف العربية) |

**نقاط القوة:** عزل المساحات، التصنيف بمعرّفات لا نصوص، خطّ المهام، طبقة الذكاء الاصطناعي المجرّدة، الاختبارات.
**الفجوات أمام Exam Builder:** لا بنك أسئلة مستقلّ عن الاختبار (السؤال يعيش داخل `quizzes` فقط)، لا ورقة امتحان ورقية، لا PDF عربي، لا تصنيف صعوبة/مدة/نقاط موحّد، لا بحث نصّي مفهرس (ILIKE فقط).

## 2. Database Audit

| الجدول | الدور | ما ينقصه للبنك |
|---|---|---|
| `questions` (داخل `quizzes`) | سؤال اختبار إلكتروني: نوع، نصّ، نقاط، مفتاح إجابة، مهارة | لا مادة/صفّ/وحدة/صعوبة/مصدر/سنة؛ مرتبط بالاختبار (يُحذف معه)؛ لا حلّ نموذجي ولا سلّم |
| `question_options` | اختيارات MCQ | — |
| `skills` | مهارات علاجية بمادة وعقدة منهاج | يُعاد استعماله كما هو (وسم مهارة للسؤال) |
| `curriculum_nodes` | وحدة ← فصل ← درس ← موضوع، مرتبطة بالمادة والصف والشعبة | **جاهز**: هذا هو «الوحدة/المحور/الدرس» المطلوب |
| `subjects`, `levels`, `streams`, `education_stages` | التصنيف | جاهز |
| `content_sources`, `resources` | المصادر والإسناد (بصمة فريدة، حقوق) | جاهز للربط: السؤال يشير إلى مورده الأصلي |
| `files` | ملفات الأستاذ (PDF/Word/صور) | جاهز لرفع الاختبارات القديمة |
| `rubrics` / `rubric_items` | شبكات التقييم | تُستعمل لاحقاً كسلّم تنقيط للسؤال المفتوح |
| `jobs` | مهام بتقدّم | جاهز لاستخراج الأسئلة وتوليد الامتحانات والـPDF |
| `academic_years`, `schools`, `wilayas` | مرجعية | جاهزة للترويسة الرسمية |

**لا يوجد:** امتحان ورقي، عنصر امتحان، نسخ (variants)، قالب ترويسة، حلّ/سلّم مستقل، منتجات/طلبات، تنزيلات، سوق.

## 3. What can be reused (ما يُعاد استعماله كما هو)

- التصنيف كاملاً (`subjects`/`levels`/`streams`/`curriculum_nodes`) وصفحة إدارته.
- `validateQuestion` و`gradeAnswer` (`quiz-grading.ts`): أنواع الأسئلة الإلكترونية ومفاتيحها — البنك يستعمل نفس `answer_key` فيصلح السؤال للورقة وللاختبار الإلكتروني معاً.
- خطّ المهام (`jobs`) بتقدّمه ومساريه.
- `AIProvider` وأسلوب المخططات الصارمة؛ إشعارات الفشل بالعربية.
- استخراج النصّ من الملفات والـDrive والذاكرة المؤقّتة (`doc-text.ts`, `text-cache.ts`).
- `resources` و`content_sources`: المصدر والحقوق والبصمة.
- `files` والرفع بالتذكرة؛ الإشعارات؛ سجلّ التدقيق؛ عزل المساحات.
- مكوّنات الواجهة (Card/Badge/Field/Progress/Table) وأسلوب الصفحات.

## 4. What must be rebuilt (ما يُبنى جديداً)

| المكوّن | لماذا لا يكفي القائم |
|---|---|
| **بنك الأسئلة** `bank_questions` | السؤال الحالي لا يعيش خارج اختباره ولا يحمل metadata |
| **ورقة الامتحان** `exams` + `exam_items` | كيان جديد: ترويسة رسمية، تمارين مرقّمة، نقاط، فواصل صفحات، نسخ |
| **مولّد PDF** | pdf-lib لا يدعم العربية. الخيار: HTML → PDF بمتصفّح بلا واجهة (Chromium) في حاوية خدمة، مع KaTeX للمعادلات. المرحلة الأولى: صفحة طباعة RTL جاهزة (Save as PDF من المتصفّح) ثم الخدمة |
| **محرّك الصعوبة** | لا تصنيف صعوبة اليوم؛ يُحسب من الوسم + إحصاء الأداء لاحقاً |
| **البحث** | ILIKE لا يكفي لملايين الصفوف: `tsvector` (إعداد `simple` بعد تطبيع العربية) + GIN + كلمات مفتاحية |
| **القالب** `exam_templates` | شعار/مؤسسة/خط/ترويسة/تذييل لكل أستاذ |
| **المتجر والسوق** | كيانات جديدة بالكامل (منتجات، سلّة، طلبات، تنزيلات) |

**لا يُحذف شيء:** `quizzes` تبقى الاختبار الإلكتروني، و«تصدير إلى البنك» ينسخ أسئلتها.

## 5. Proposed Architecture

```
            ┌────────────── Sources ──────────────┐
  DzExams  ─┤ resources (EXAM/SOLUTION, PDF links) ├─┐
  ملفات الأستاذ (files) ───── استخراج نصّ ──────────┼─► AI Extract ─► review queue (NEEDS_REVIEW)
  quizzes (أسئلة إلكترونية) ── "تصدير إلى البنك" ───┘                       │ موافقة الأستاذ
  إنشاء يدوي ─────────────────────────────────────────────────────────────────┤
                                                                              ▼
                              ┌──────────── bank_questions ────────────┐
                              │ metadata: مادة/صف/شعبة/عقدة/فصل/نوع/   │
                              │ صعوبة/مدة/نقاط/مصدر/سنة/امتحان/حلّ/   │
                              │ كلمات/صاحب/حقوق · tsvector · hash     │
                              └───────────────┬────────────────────────┘
          Search + Filters (keyset pagination) │   AI Agent (ابنِ لي اختباراً…)
                                               ▼
                       ┌──────── exams ────────┐   ┌──── exam_templates ────┐
                       │ exam_items (ترتيب،    │◄──┤ ترويسة/شعار/خط/تذييل  │
                       │ نقاط، فاصل صفحة)       │   └────────────────────────┘
                       │ exam_variants (A/B/C)  │
                       └──────────┬─────────────┘
                                  ▼
                  Renderer (HTML RTL + KaTeX) ─► PDF: الموضوع · التصحيح · السلّم
                                  ▼
                 exam_downloads · analytics · student practice (adaptive)
```

**مبادئ:** كل شيء Modular (خدمة + مخطط + صفحة لكل وحدة)، السؤال وحدة قابلة لإعادة الاستعمال، الذكاء الاصطناعي **يقترح ويُراجَع** (لا حفظ بلا Validation)، المصدر لا يُمسح أبداً، كل استعلام مقيّد بالمساحة أو بالرؤية العامة.

## 6. Database Schema (المقترح الكامل؛ المرحلة 1 منه منفّذة)

### المرحلة 1 — `0013_question_bank` ✅
`bank_questions`: `id`, `workspace_id` (null = بنك Madrasadz المركزي), `author_user_id`, `parent_id` (أسئلة فرعية تحت تمرين/نصّ), `kind` (QUESTION|EXERCISE|PASSAGE|PROBLEM|INTEGRATIVE|DOCUMENT), `type` (MCQ|TRUE_FALSE|SHORT_ANSWER|LONG_ANSWER|FILL_BLANK|MATCHING|IMAGE|OPEN), `title`, `body` (Markdown + LaTeX بين `$…$`), `options` jsonb, `answer_key` jsonb, `solution` (حلّ نموذجي), `bareme` jsonb (سلّم), `points`, `difficulty` 1–4, `estimated_minutes`, `subject_id`, `level_id`, `stream_id`, `curriculum_node_id`, `school_term`, `exam_kind` (BAC|BEM|TEST|HOMEWORK|QUIZ|PRACTICE|OTHER), `source_id`, `source_resource_id`, `source_year`, `source_label`, `original_file_id`, `rights_status`, `language`, `keywords text[]`, `image_file_id`, `attachments` jsonb, `visibility` (PRIVATE|PUBLIC), `status` (DRAFT|NEEDS_REVIEW|PUBLISHED|ARCHIVED), `import_batch_id`, `content_hash`, `search_text` + عمود `search tsvector` مولَّد بفهرس GIN, `usage_count`, `last_used_at`, `sort_order`, timestamps + soft delete.
`bank_favorites`: (`user_id`, `question_id`).

### المراحل التالية (مخطّطة)
- **0014 `exams`**: `exams` (workspace, title, kind: TEST|HOMEWORK|BAC_MOCK|QUIZ, subject/level/stream/term, duration_minutes, total_points, difficulty_summary jsonb, template_id, header jsonb, status, pdf_file_id, solution_pdf_file_id, source_exam_id للنسخ), `exam_items` (exam_id, position, kind: EXERCISE|QUESTION|PAGE_BREAK|TEXT, bank_question_id nullable, snapshot jsonb — نسخة مجمّدة من السؤال وقت الإدراج، points, numbering), `exam_variants` (exam_id, label A/B/C, seed, item_order jsonb, option_order jsonb, substitutions jsonb), `exam_templates` (workspace, name, school, logo_file_id, header_lines jsonb, footer, font, is_default), `exam_downloads` (exam_id, user_id, kind, at).
- **0015 `search_index`**: `tsvector` + GIN على `resources` و`bank_questions` (المرحلة 1 أدرجته للبنك).
- **0016 `practice`**: `practice_sessions`, `practice_answers`, `student_skill_progress` (بالمادة والعقدة).
- **0017 `store`**: `products` (BOOK|PDF|PACK|COURSE|SUBSCRIPTION), `product_files`, `carts`, `orders`, `order_items`, `payments` (COD أولاً), `downloads`.
- **0018 `marketplace`**: `listings` (exam|exercise_set|summary|question_bank)، `listing_purchases`, `teacher_payouts`.
- **0019 `ai_layer`**: `ai_usage_logs`, `ai_budgets`, `ai_cache`, pgvector `embeddings` (بعد تبديل الصورة).
- **0020 `credits`**: `plans`, `teacher_subscriptions`, `usage_counters`.

كل الهجرات إضافية وبملف تراجع؛ لا تُعاد تسمية جداول مستعملة.

## 7. Implementation roadmap

| المرحلة | التسليم | يعتمد على |
|---|---|---|
| **1 ✅ Question Bank** | المخطط والخدمات (إنشاء/تعديل/أرشفة/نشر، فلاتر 14 بعداً، بحث نصّي، ترقيم بالمؤشّر)، صفحة `/teacher/bank` (بنكي / المركزي / الكل)، نموذج سؤال كامل بالأنواع، **تصدير أسئلة اختبار موجود إلى البنك**، **رفع PDF/Word ← استخراج بالذكاء الاصطناعي ← قائمة مراجعة** (لا حفظ قبل الموافقة)، المفضّلة، اختبارات آلية | 0010–0012 |
| **2 ✅ Exam Builder** | `exams`/`exam_items` (0014): محرّر ثلاثي الأعمدة (بنك ← ورقة ← إعدادات)، سحب وإفلات HTML5 + أزرار للمس، ترتيب، نسخ، حذف، تعديل داخل الورقة (نسخة مجمّدة لا تمسّ البنك)، تمرين حرّ، نصّ، فاصل صفحة، ترقيم تلقائي، مجموع النقاط الحيّ مع «إعادة توزيع» إلى المستهدف بخطوات 0.5، ملخّص الصعوبة (توزيع، درجة مرجّحة، زمن تقديري)، نسخ الامتحان | 1 |
| **3 ✅ PDF** | `/print/exams/[id]`: صفحة A4 RTL رسمية (الجمهورية، الوزارة، المؤسسة، المادة، المستوى، المدة، الأستاذ، السنة الدراسية، عنوان الورقة، التعليمات)، KaTeX مُصيَّر في الخادم (بلا CDN؛ CSS والخطوط مستضافة في `public/katex`)، فواصل صفحات، خانات صح/خطأ، سطور إجابة، تذييل المصادر اختياري؛ «طباعة / حفظ PDF» من المتصفّح (PDF حقيقي بتشكيل عربي كامل). **لاحقاً:** خدمة Chromium على الخادم لحفظ الملف في `files` وتتبّع التنزيلات | 2 |
| **4 ✅ Solutions & Barème** | وضع `?mode=correction`: جدول توزيع النقاط، ولكل عنصر الإجابة (MCQ/صح-خطأ/قصير/فراغات/مطابقة) والحلّ النموذجي وسلّم التنقيط، وللفرعيات كذلك | 3 |
| **5 AI Exam Generator** | «ابنِ لي اختباراً»: بحث في البنك ← اختيار بتوزيع صعوبة (30/50/20) ← سدّ النقص بتوليد أسئلة مشابهة (مُراجَعة) ← ورقة جاهزة؛ `Generate variants` A/B/C/D؛ تجنّب المستعمل سابقاً (`usage_count`/`last_used_at`) | 2, 4 |
| **6 Teacher Workspace** | لوحة: امتحاناتي، أسئلتي، ملفات PDF، أفواجي، قوالبي، المفضّلة، الأخيرة، المولّد؛ القوالب؛ سجلّ الامتحانات (نسخ/تعديل/تنزيل/إعادة توليد)؛ إحصاءات | 2–5 |
| **7 Student Practice** | التلميذ يختار مادة/درس/صعوبة ← سلسلة من البنك (PUBLISHED+PUBLIC) ← تصحيح آلي (`gradeAnswer`) ← نقاط ضعف | 1 |
| **8 Adaptive** | من `practice_answers` إلى `student_skill_progress` وتوصيات بالعقدة | 7 |
| **9 Library** | محرّك بحث موحّد على `resources` + البنك + المحتوى؛ أقسام المكتبة؛ مراكز المواد | 0015 |
| **10 Book Store** | منتجات، سلّة، طلبات، دفع عند الاستلام، تتبّع | — |
| **11 Marketplace** | نشر الأساتذة، مجاني/مدفوع، نسب، حقوق | 10 |
| لاحقاً | Credits/Pro، BAC Generator (قالب هيكلة رسمي لكل شعبة)، الصفحة الرئيسية الجديدة | 5, 6 |

**KPI المرحلة 2:** اختبار كامل في أقل من 5 دقائق — يُقاس من فتح المحرّر إلى تنزيل PDF.

### قرارات تقنية
- **LaTeX:** يُخزَّن كما هو في `body` بين `$…$` ويُعرض بـKaTeX في الواجهة والطباعة.
- **PDF:** لا pdf-lib للعربية. HTML+CSS للطباعة هي المصدر الوحيد للحقيقة (شاشة = ورقة)، والخادم يحوّلها بمتصفّح بلا واجهة.
- **OCR:** الصور الممسوحة تحتاج Tesseract أو خدمة OCR؛ المرحلة 1 تستخرج من PDF/Word النصّية فقط وتُعلم الأستاذ إن كان الملف مصوّراً.
- **الحقوق:** `rights_status` + `source_*` إلزامية عند الاستيراد؛ المصدر يظهر في ورقة الامتحان (تذييل خفيف) عند اختيار الأستاذ.
- **الأداء:** ترقيم بالمؤشّر، فهارس (مادة، صف، عقدة، صعوبة، حالة)، GIN للبحث والكلمات، لا `count(*)` على القوائم الكبيرة إلا مقدّراً.
