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

### المرحلة 2 — `0014_exams` ✅
`exams` (workspace, created_by, title, kind, subject/level/stream/term, academic_year, duration_minutes, target_points, total_points, instructions, header jsonb, difficulty_summary jsonb, status DRAFT|READY|ARCHIVED, source_exam_id, pdf_file_id, solution_pdf_file_id) و`exam_items` (exam_id, position, kind EXERCISE|QUESTION|TEXT|PAGE_BREAK, bank_question_id, title, points, snapshot jsonb). النسخ A–D تُحسب عند الطباعة من بذرة حتمية (لا جدول `exam_variants`).

### المرحلة 6 — `0015_exam_workspace` ✅
على `exams`: `is_template` (قوالبي)، `group_id` (الفوج المعدّ له)، `print_count` و`last_printed_at` (تُحدَّث من زرّ الطباعة مع حدث `exam.print` في `audit_logs`). السجلّ والإحصاءات تُشتقّ من `audit_logs` و`exams` بلا جداول جديدة.

### المرحلة 7 — `0016_practice` ✅
`practice_sessions` (student, subject, level/stream وقت البدء, curriculum_node اختياري, difficulty اختيارية, status ACTIVE|FINISHED, question_count, answered_count, correct_count, score_pct, started/finished_at) و`practice_answers` (session, student, question ← `bank_questions`, position, answer jsonb بصيغة quiz-grading, is_correct, score, points, answered_at). المصدر: أسئلة البنك المنشورة **العامة** فقط، من الأنواع القابلة للتصحيح الآلي (MCQ، صح/خطأ، قصيرة، فراغات، مطابقة)، بمستوى التلميذ وشعبته.

### المرحلة 8 — `0017_adaptive` ✅
`student_node_progress` (student, subject, curriculum_node، attempts, correct, score 0–100 متوسط متحرّك بوزن 0.3 للأحدث, streak, mastered_difficulty, last_at؛ فريد على التلميذ والعقدة). يُغذّى من كل إجابة تدريب ذاتي ويُعاد بناؤه من `practice_answers` عند الحاجة.

### المرحلة 9 — `0018_search_index` ✅
على `resources`: عمود `search` tsvector مولَّد من العنوان والوصف والمؤلّف الأصلي + فهرس GIN (بنك الأسئلة له فهرسه منذ 0013). لا جداول جديدة: المكتبة تقرأ من `resources` و`bank_questions` و`content`.

### المرحلة 10 — `0019_store` ✅
`products` (slug, title, description, type BOOK|PDF|PACK, author, pages, price_dzd, compare_price_dzd, stock (فارغ = غير محدود), subject/level/stream, cover_file_id/cover_url, status DRAFT|PUBLISHED|ARCHIVED, sort_order, sales_count, workspace_id للسوق لاحقاً)، `product_files` (الملفات الرقمية ← `files`)، `orders` (number, user, status PENDING|CONFIRMED|SHIPPED|DELIVERED|CANCELLED, payment COD|TRANSFER|FREE, needs_shipping, subtotal/shipping/total بالدينار, customer_name, phone, wilaya, address, note, admin_note, طوابع الحالات, cancel_reason)، `order_items` (نسخة مجمّدة من العنوان والسعر)، `downloads` (سجلّ كل تنزيل). السلّة في متصفّح العميل (localStorage) وتُرسل كاملة عند الطلب — لا جدول `carts`.

### المراحل التالية (مخطّطة)
- **0014 `exams`** (المقترح الأصلي؛ نُفّذ مبسّطاً أعلاه): `exams` (workspace, title, kind: TEST|HOMEWORK|BAC_MOCK|QUIZ, subject/level/stream/term, duration_minutes, total_points, difficulty_summary jsonb, template_id, header jsonb, status, pdf_file_id, solution_pdf_file_id, source_exam_id للنسخ), `exam_items` (exam_id, position, kind: EXERCISE|QUESTION|PAGE_BREAK|TEXT, bank_question_id nullable, snapshot jsonb — نسخة مجمّدة من السؤال وقت الإدراج، points, numbering), `exam_variants` (exam_id, label A/B/C, seed, item_order jsonb, option_order jsonb, substitutions jsonb), `exam_templates` (workspace, name, school, logo_file_id, header_lines jsonb, footer, font, is_default), `exam_downloads` (exam_id, user_id, kind, at).
- **0019 `marketplace`**: `listings` (exam|exercise_set|summary|question_bank)، `listing_purchases`, `teacher_payouts`.
- **0020 `ai_layer`**: `ai_usage_logs`, `ai_budgets`, `ai_cache`, pgvector `embeddings` (بعد تبديل الصورة).
- **0021 `credits`**: `plans`, `teacher_subscriptions`, `usage_counters`.

كل الهجرات إضافية وبملف تراجع؛ لا تُعاد تسمية جداول مستعملة.

## 7. Implementation roadmap

| المرحلة | التسليم | يعتمد على |
|---|---|---|
| **1 ✅ Question Bank** | المخطط والخدمات (إنشاء/تعديل/أرشفة/نشر، فلاتر 14 بعداً، بحث نصّي، ترقيم بالمؤشّر)، صفحة `/teacher/bank` (بنكي / المركزي / الكل)، نموذج سؤال كامل بالأنواع، **تصدير أسئلة اختبار موجود إلى البنك**، **رفع PDF/Word ← استخراج بالذكاء الاصطناعي ← قائمة مراجعة** (لا حفظ قبل الموافقة)، المفضّلة، اختبارات آلية | 0010–0012 |
| **2 ✅ Exam Builder** | `exams`/`exam_items` (0014): محرّر ثلاثي الأعمدة (بنك ← ورقة ← إعدادات)، سحب وإفلات HTML5 + أزرار للمس، ترتيب، نسخ، حذف، تعديل داخل الورقة (نسخة مجمّدة لا تمسّ البنك)، تمرين حرّ، نصّ، فاصل صفحة، ترقيم تلقائي، مجموع النقاط الحيّ مع «إعادة توزيع» إلى المستهدف بخطوات 0.5، ملخّص الصعوبة (توزيع، درجة مرجّحة، زمن تقديري)، نسخ الامتحان | 1 |
| **3 ✅ PDF** | `/print/exams/[id]`: صفحة A4 RTL رسمية (الجمهورية، الوزارة، المؤسسة، المادة، المستوى، المدة، الأستاذ، السنة الدراسية، عنوان الورقة، التعليمات)، KaTeX مُصيَّر في الخادم (بلا CDN؛ CSS والخطوط مستضافة في `public/katex`)، فواصل صفحات، خانات صح/خطأ، سطور إجابة، تذييل المصادر اختياري؛ «طباعة / حفظ PDF» من المتصفّح (PDF حقيقي بتشكيل عربي كامل). **لاحقاً:** خدمة Chromium على الخادم لحفظ الملف في `files` وتتبّع التنزيلات | 2 |
| **4 ✅ Solutions & Barème** | وضع `?mode=correction`: جدول توزيع النقاط، ولكل عنصر الإجابة (MCQ/صح-خطأ/قصير/فراغات/مطابقة) والحلّ النموذجي وسلّم التنقيط، وللفرعيات كذلك | 3 |
| **5 ✅ AI Exam Generator** | `/teacher/exams/generate` «ابنِ لي الامتحان»: طلب حرّ بالعربية يُحوَّل إلى الحقول بلا نموذج (`parseExamRequest`: المادة/الصف/الشعبة من القاعدة، المدة، عدد التمارين، الفصل، الصعوبة، النوع) ← اختيار حتمي من البنك (`selectFromBank`: مادة+صف+شعبة، تفضيل الفصل، حصص صعوبة من النسب، زمن الحلّ ضمن المدة، الأقل استعمالاً أولاً عبر `usage_count`/`last_used_at`، تعويض النقص من الصعوبة المجاورة) ← ورقة مسودة بنقاط موزّعة فوراً ← الناقص فقط يولّده الذكاء الاصطناعي في مهمة `AI_BUILD_EXAM` **مشابهاً لأمثلة من البنك**، يُدرج موسوماً «راجعه» وتُحفظ نسخة `NEEDS_REVIEW` في البنك (لا نشر آلي)؛ نسخ A/B/C/D في الطباعة (`?variant=`): خلط حتمي للعناصر داخل كل صفحة ولاختيارات MCQ، نفس النقاط والصعوبة، وورقة التصحيح تتبع النسخة | 2, 4 |
| **6 ✅ Teacher Workspace** | `/teacher/exams` ورشة: شريط إحصاءات (الامتحانات، القوالب، طباعات الشهر، أسئلتي، المراجعة)، نطاقات (الكل / المسودات / الجاهزة / قوالبي / الأرشيف)، تصفية (بحث، مادة، صف، نوع، فوج)؛ القوالب (`is_template`: تحويل بضغطة، «استعمال» ينشئ امتحاناً كاملاً من القالب)؛ الحالة جاهز/مسودة والفوج من إعدادات المحرّر؛ أرشفة/استرجاع؛ تسجيل الطباعة (`print_count`, `exam.print`)؛ `/teacher/exams/[id]/history` سجلّ الأحداث والنسخ المشتقّة والأصل؛ `/teacher/exams/stats` حسب المادة والنوع، صعوبة الأوراق، طباعات 6 أشهر، الأسئلة الأكثر استعمالاً، الأخيرة؛ زرّ «ابنِ لي الامتحان» في لوحة الأستاذ. **لاحقاً:** تنزيلات PDF المحفوظة في `files` (مع خدمة Chromium) | 2–5 |
| **7 ✅ Student Practice** | `/student/practice`: المواد والدروس التي فيها أسئلة عامة بمستوى التلميذ (بالأعداد)، صعوبة وعدد ← جلسة تُسحب عشوائياً مع تفضيل ما لم يره في 30 يوماً (الدرس يشمل فروعه) ← سؤال واحد في كل مرة: تحقّق فوري بـ`gradeAnswer`، الإجابة الصحيحة والحلّ بعد الجواب فقط (المفتاح لا يُرسل قبلها)، لا تُعاد الإجابة ← إنهاء بملخّص: النسبة، حسب الدرس، نقاط الضعف (<60%) ← نظرة عامة: جلسات، نسبة الصواب، أضعف الدروس في آخر 200 إجابة مع زرّ «تدرّب» عليها، حسب المادة؛ رابط «تدريب ذاتي» في قائمة التلميذ | 1 |
| **8 ✅ Adaptive** | التقدّم بالدرس يُحدَّث عند كل إجابة؛ الجلسة التكيّفية (افتراضية) تختار الصعوبة من التقدّم: جديد/ضعيف ← سهل–متوسط، متوسط ← متوسط (وصعب بعد 3 متتالية)، قوي ← صعب–صعب جداً، وصعوبة محدّدة تلغيه؛ توصيات في `/student/practice`: «راجع» (ضعيف بعد ≥3 محاولات)، «جديد» (دروس فيها أسئلة لم تُلمس)، «ارفع الصعوبة» (قوي ولم يتقن أعلى صعوبة متاحة) بزرّ يبدأ الجلسة مباشرة؛ «تقدّمي بالدروس» في `/student/progress`؛ للأستاذ: تقدّم تلميذه بالدرس في ملفه (لتلاميذ أفواجه فقط) و«دروس يتعثّر فيها الفوج» في صفحة الفوج | 7 |
| **9 ✅ Library** | `/library` واجهة عامة: بحث موحّد (`librarySearch`: الموارد المنشورة العامة + البنك العام + محتوى الأكاديمية؛ tsquery على الفهرس ثم ILIKE؛ الرسمي أولاً؛ قيود المادة/الصف/الشعبة/القسم)، أقسام بالأعداد (دروس وملخّصات، تمارين وفروض، اختبارات وامتحانات، فيديوهات، وثائق + بكالوريات رسمية)، المواد بالأعداد؛ `/library/search` نتائج بفلاتر؛ `/library/[subject]` مركز المادة: الصفوف بالأعداد، الأقسام، الدروس بعدد مواردها، أحدث الموارد لكل قسم، سنوات البكالوريا؛ `/library/q/[id]` عرض عام لسؤال/تمرين من البنك مع حلّه؛ روابط «المكتبة» في رأس الموقع وقائمة التلميذ. كل مورد يحمل مصدره؛ الخارجي يُفتح عند مصدره | 0018 |
| **10 ✅ Book Store** | `/store` عام: كتب ورقية وPDF وحزم بالمادة والصف والنوع والبحث؛ صفحة المنتج؛ سلّة محلية؛ الطلب لمن سجّل دخوله (أي دور): مادي ⇒ دفع عند الاستلام (ولاية + عنوان، رسوم شحن من `STORE_SHIPPING_DZD`)، رقمي مدفوع ⇒ تحويل CCP/BaridiMob ينتظر تأكيد المشرف، مجاني ⇒ مُسلَّم فوراً؛ `/store/orders` و`/store/orders/[id]` بتتبّع الحالة وتنزيل الملفات عبر روابط موقّعة (10 دقائق) بعد التأكيد مع تسجيل كل تنزيل؛ إشعارات: المشرف بالطلبات الجديدة، والعميل بكل تغيير حالة؛ `/admin/store`: إحصاءات، الطلبات بحالاتها وانتقالات مضبوطة (الإلغاء يعيد المخزون)، المنتجات (إنشاء/تعديل بنموذج مع غلاف وملفات PDF، نشر/إخفاء/أرشفة/حذف). **لاحقاً:** دفع إلكتروني (CIB/Edahabia) عند توفّر بوابة، وشركات توصيل | 0019 |
| **11 Marketplace** | نشر الأساتذة، مجاني/مدفوع، نسب، حقوق | 10 |
| لاحقاً | Credits/Pro، BAC Generator (قالب هيكلة رسمي لكل شعبة)، الصفحة الرئيسية الجديدة | 5, 6 |

**KPI المرحلة 2:** اختبار كامل في أقل من 5 دقائق — يُقاس من فتح المحرّر إلى تنزيل PDF.

### قرارات تقنية
- **LaTeX:** يُخزَّن كما هو في `body` بين `$…$` ويُعرض بـKaTeX في الواجهة والطباعة.
- **PDF:** لا pdf-lib للعربية. HTML+CSS للطباعة هي المصدر الوحيد للحقيقة (شاشة = ورقة)، والخادم يحوّلها بمتصفّح بلا واجهة.
- **OCR:** الصور الممسوحة تحتاج Tesseract أو خدمة OCR؛ المرحلة 1 تستخرج من PDF/Word النصّية فقط وتُعلم الأستاذ إن كان الملف مصوّراً.
- **الحقوق:** `rights_status` + `source_*` إلزامية عند الاستيراد؛ المصدر يظهر في ورقة الامتحان (تذييل خفيف) عند اختيار الأستاذ.
- **الأداء:** ترقيم بالمؤشّر، فهارس (مادة، صف، عقدة، صعوبة، حالة)، GIN للبحث والكلمات، لا `count(*)` على القوائم الكبيرة إلا مقدّراً.
