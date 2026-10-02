# MADRASADZ TEACHER EXAM STUDIO — خطة التدقيق والتنفيذ

تاريخ التدقيق: 2026-10-02 · الفرع `claude/arabic-edtech-platform-wfcst1` · HEAD قبل العمل `8490dfe`.
يكمّل هذا المستند `EXAM_BUILDER_ARCHITECTURE.md` (منشئ الامتحانات) و`MADRASADZ_EXAM_ENGINE_PLAN.md` (محرّك البكالوريا) ولا يلغي أيّاً منهما: الاستوديو يُبنى **فوق** الجدولين `exams` و`exam_items` الموجودين، لا بجانبهما.

> المبدأ: ورقة الامتحان الحالية هي أصلاً **قائمة كتل مرتّبة** (`exam_items` بترتيب `position`، وفواصل الصفحات `PAGE_BREAK` موجودة). الاستوديو يوسّع أنواع الكتل ويضيف محرّراً بصرياً ومحرّك رياضيات ومنحنيات وقوالب وتصديراً — من دون جدول جديد للصفحات أو الكتل.

---

## 1. CURRENT STATE — الحالة الحالية (ما فحصته فعلاً)

| الطبقة | الملف | الحال |
|---|---|---|
| مخطط الامتحان | `src/server/db/schema/exams.ts` | `exams` (عنوان، نوع، مادة/صف/شعبة، فصل، مدة، `target_points`، `total_points`، `header` JSON، `is_template`، `group_id`، حالة DRAFT/READY/ARCHIVED، عدّاد طباعة) + `exam_items` (`position`، `kind` ∈ EXERCISE/QUESTION/TEXT/PAGE_BREAK، `bank_question_id`، `title`، `points`، `snapshot` JSON مجمّد) |
| النسخة المجمّدة | `ExamItemSnapshot` | kind/type/title/body/options/answerKey/solution/bareme/points/difficulty/estimatedMinutes/sourceLabel/sourceYear/keywords/children |
| الخدمة | `src/server/services/exams.service.ts` (663 سطراً) | إنشاء/تعديل/حذف/نسخ، إدراج من البنك بنسخة مجمّدة واحتساب الاستعمال، عنصر حرّ، تعديل داخل الورقة، ترتيب، فاصل صفحة، `proposeDistribution`/`rebalancePoints`، قوالب (`createFromTemplate`)، سجلّ (`examHistory` من `audit_logs`)، إحصاءات، نسخ إلى مساحة أخرى (السوق) |
| الإجراءات | `src/server/actions/exams.actions.ts` | zod + `runAction` + `revalidatePath`؛ بحث البنك من المحرّر `searchBankAction`؛ التوليد `buildExamAction` (MANUAL/SMART بالبنك، AI بالخلفية)، `parseExamRequestAction` (AI Mode)، `replaceItemAction`، التدرّج `setProgressAction`، `buildBacMockAction` |
| المحرّر | `src/components/domain/exam-builder.tsx` (630 سطراً) | ثلاثة أعمدة: بنك (سحب HTML5 أصلي) ← ورقة ← إعدادات؛ تعديل داخل الورقة (`ItemEditor`: عنوان/نقاط/نصّ/حلّ/نقاط الفرعيات)؛ تمرين حرّ/نصّ/فاصل؛ مجموع وصعوبة؛ إعادة توزيع؛ أزرار PDF الموضوع/التصحيح؛ النسخ A–D |
| الطباعة | `src/app/print/exams/[id]/page.tsx` + `src/components/domain/exam-print.tsx` + `src/components/domain/print-toolbar.tsx` | A4 بـCSS داخلي، `mode=subject|correction`، `variant=A..D` حتمية (`applyVariant`)، ترقيم تلقائي، ملخّص السلّم في التصحيح، `window.print()` ← حفظ PDF من المتصفح، تسجيل الطباعة |
| الرياضيات | `src/server/lib/exam-render.ts` | KaTeX في الخادم: `$…$` ضمن السطر و`$$…$$` معروض، `**غامق**`، فقرات؛ CSS من `public/katex` (لا CDN — CSP صارم) |
| البنك | `src/server/services/question-bank.service.ts` | `listBankQuestions` بمرشّحات غنية (نطاق، نصّ، مادة/صف/شعبة/درس/فصل، أنواع، صعوبات، سنة، حلّ…)، مفضّلة، فرعيات، أصل السؤال (ORIGINAL/SOURCED/AI_GENERATED/ADAPTED) ووثيقته |
| التوليد | `exam-generator.service.ts`, `bac-generator.service.ts`, `src/lib/bac-templates.ts` | فتحات (درس/صعوبة/نقاط)، احترام التدرّج، استبدال تمرين، هيكلة بكالوريا رسمية لكل مادة/شعبة |
| الذكاء الاصطناعي | `src/server/ai/*` | واجهة `AIProvider` (openai/anthropic/mock) بمخططات JSON صارمة؛ المفتاح في الخادم فقط؛ `withAiTask` + `ai_usage_logs`؛ `checkRateLimit(aiRequest)` |
| الملفات | `src/server/lib/storage.ts`, `/api/v1/files/[id]` | رفع بتذكرة من المتصفح (`uploadViaTicket`)، صور jpeg/png/webp مسموحة، روابط موقّعة قصيرة العمر |
| الاختبارات | `tests/exams.test.ts`, `exam-render.test.ts`, `exam-generator.test.ts`, `exam-engine.test.ts` | 254 اختباراً تمرّ (PGlite في الذاكرة، الهجرات تُطبَّق من `drizzle/`) |
| الهجرات | `drizzle/0000…0021` + `drizzle/down/` | SQL مكتوب يدوياً مع `_journal.json`؛ ملفات تراجع من 0010 |

**لا يوجد:** محرّر كتل بصري، معاينة A4 مرقّمة في المحرّر، محرّر معادلات، راسم منحنيات، أدوات هندسة، جدول/جدول تغيّرات، كتلة شعر، باني ترويسة، مكتبة كتل، DOCX، نسخة «سلّم التنقيط» مستقلة، مراجعات (revisions)، تراجع/إعادة، AI Copilot على عنصر، وضع السبّورة، QR.

## 2. WHAT EXISTS — ما يُعاد استعماله كما هو

- الوثيقة = `exams` + `exam_items` (الترتيب، النسخ المجمّدة، النقاط، الصعوبة، الزمن التقديري).
- الصفحات = مقاطع بين عناصر `PAGE_BREAK` (تُشتقّ، لا تُخزَّن).
- الترويسة الجزائرية الأساسية (`ExamHeader`: المؤسسة/الولاية/الأستاذ/العنوان/التاريخ/المصادر) والسنة الدراسية الحالية.
- النسخ A/B/C/D الحتمية، ترقيم «التمرين الأول…»، ملخّص السلّم، إعادة توزيع النقاط على 20.
- لوحة البنك داخل المحرّر (بحث، نطاق، صعوبة، سحب وإفلات، «في الورقة»)، الاستبدال بنفس المعايير، التوليد الثلاثي (يدوي/ذكي/AI Mode) الذي ينتهي بفتح الورقة في المحرّر.
- KaTeX في الخادم للطباعة (نفس الدالة `renderBody` تعمل في المتصفح أيضاً لأنها لا تعتمد على شيء خاصّ بالخادم).
- القوالب الشخصية (`is_template` + `createFromTemplate`)، النسخ، الأرشفة، السجلّ، الإحصاءات، السوق.
- رفع الصور، الروابط الموقّعة، مزوّد الذكاء الاصطناعي ومحاسبة الاستهلاك والحدّ من الطلبات.

## 3. WHAT IS MISSING — ما ينقص (وما يُبنى)

| المطلوب | القرار |
|---|---|
| كتل منظّمة (عنوان، فقرة، معادلة، منحنى، هندسة، جدول، جدول تغيّرات، شعر، صورة، مساحة إجابة، فاصل، ملاحظة) | نوع عنصر جديد `BLOCK` في `exam_items.kind` + `snapshot.block` بمخطط موحّد (`src/lib/exam-blocks.ts`) |
| شكل داخل التمرين (منحنى/جدول/معادلة بين النصّ والأسئلة الفرعية) | `snapshot.figures?: StudioBlock[]` على EXERCISE/QUESTION |
| تخطيط الورقة (حجم الخطّ، الهوامش، التذييل، ترقيم الصفحات، تخطيط الترويسة، حقول التلميذ، QR، الشعار) | عمود `exams.layout jsonb` (إضافي) |
| مراجعات + تراجع/إعادة | جدول `exam_revisions` (لقطة كاملة) + مكدّس تراجع في المتصفح يعكس كل إجراء بإجراء معاكس حقيقي |
| مكتبة الأستاذ للكتل المحفوظة | جدول `teacher_library_items` |
| مفضّلة الامتحانات/القوالب | عمود `exams.is_favorite` |
| قوالب Madrasadz الرسمية | ملف كود `src/lib/studio-templates.ts` (بلا صفوف بلا مساحة عمل) تُستنسخ إلى مساحة الأستاذ |
| نسخة سلّم التنقيط + فحص المجموع | `mode=marking` في صفحة الطباعة + تحذير ≠ 20 |
| DOCX | حزمة `docx` (JS خالصة) عبر `/api/v1/exams/[id]/docx`؛ المعادلات نصّاً خطّياً (محوّل LaTeX→Unicode)، المنحنيات صوراً إن أمكن وإلا تنويه |
| معاينة A4 مرقّمة وتحذيرات التجاوز | قياس ارتفاع الكتل في المتصفح بعرض A4 ثم توزيع جشع على الصفحات (`src/lib/paginate.ts`) |
| AI Copilot | إجراء خادمي واحد `copilotAction` بمخطط JSON، معاينة ثم قبول/رفض؛ المفتاح في الخادم؛ حدّ طلبات؛ محاسبة |
| وضع السبّورة | مسار `/teacher/exams/[id]/board` |

## 4. WHAT CAN BE REUSED — التفصيل

- `exam-builder.tsx` يُحوَّل إلى `src/components/studio/*` بالتدريج: لوحة البنك والإعدادات والمجموع والصعوبة تبقى بسلوكها؛ تُضاف الكتل والمعاينة والتراجع والشريط العلوي.
- `exam-print.tsx` يُوسَّع ليعرض الكتل الجديدة (نفس CSS) وinode `marking`.
- `applyVariant` تُحسَّن: تخلط **المرقّم** فقط (التمارين/الأسئلة)؛ العناوين والفقرات والأشكال تبقى في مواضعها (التعليمات قبل التمرين لا تُخلط).
- `ItemPatch`/`updateItem` تُوسَّع إضافياً: `figures`، `children` (تحرير الأسئلة الفرعية)، `bareme`، `options` موجودة.
- `createFromTemplate` تُستعمل للقوالب الشخصية؛ قوالب Madrasadz تمرّ بنفس الدالة بعد إنشاء صفوف من الكود.

## 5. DATABASE CHANGES — هجرة إضافية واحدة `0022_exam_studio`

```sql
ALTER TABLE exam_items DROP CONSTRAINT exam_items_kind_check;
ALTER TABLE exam_items ADD CONSTRAINT exam_items_kind_check CHECK (kind IN ('EXERCISE','QUESTION','TEXT','PAGE_BREAK','BLOCK'));
ALTER TABLE exams ADD COLUMN layout jsonb NOT NULL DEFAULT '{}';
ALTER TABLE exams ADD COLUMN is_favorite boolean NOT NULL DEFAULT false;
CREATE TABLE exam_revisions (id, exam_id → exams cascade, number int, reason AUTO|MANUAL|RESTORE, label, snapshot jsonb, created_by_user_id, created_at);
CREATE TABLE teacher_library_items (id, workspace_id → teacher_workspaces cascade, created_by_user_id, kind BLOCK|HEADER, title, subject_id?, level_id?, tags text[], payload jsonb, is_favorite, usage_count, created_at, updated_at, deleted_at);
```
- لا حذف، لا إعادة تسمية، لا تغيير نوع عمود. ملف تراجع `drizzle/down/0022_exam_studio.down.sql`.
- البيانات القديمة تعمل بلا تحويل: `layout = {}` يعني التخطيط الافتراضي الحالي حرفياً.

## 6. COMPONENT PLAN — `src/components/studio/`

| المكوّن | الدور |
|---|---|
| `studio.tsx` | الغلاف: الحالة، مكدّس التراجع/الإعادة (Ctrl+Z/Y)، الحفظ التلقائي بتأخير، الأدراج للهاتف، الوضع المركّز/الكامل |
| `paper.tsx` | الورقة: صفحات مشتقّة من الفواصل، سحب وإفلات بين العناصر، مناطق إفلات |
| `item-card.tsx` / `item-editor.tsx` | التمرين/السؤال: نصّ بشريط رياضيات، فرعيات (إضافة/حذف/نقاط/حلّ)، QCM (اختيارات وصحيح وأعمدة)، أشكال داخل التمرين، سلّم |
| `block-editors.tsx` | محرّر لكل نوع كتلة، بمعاينة حيّة |
| `math-input.tsx` | حقل نصّ + لوحة LaTeX (كسر، جذر، أسّ، تكامل، مجموع، نهاية، أشعة، مجموعات، يونانية) + معاينة KaTeX في المتصفح (تحميل كسول) |
| `graph-editor.tsx` + `src/lib/graph.ts` | تعريف منحنى: دوال (محلّل تعابير آمن، بلا eval)، مجال، شبكة، نقاط، مستقيمات مقاربة؛ SVG خالص يعمل في الخادم والمتصفح؛ تصدير SVG |
| `geometry-editor.tsx` + `src/lib/geometry.ts` | نقاط/قطع/دوائر/مضلّعات/أسماء على شبكة؛ SVG |
| `variation-table.tsx` + `src/lib/variation-table.ts` | جدول تغيّرات/إشارة بأسهم |
| `header-builder.tsx` | الترويسة الجزائرية: تخطيطات، حقول، حقول التلميذ، شعار، QR، معاينة |
| `block-library.tsx` | شريط الكتل الجانبي، ترتيب حسب المادة، مكتبتي (كتل محفوظة) |
| `bank-panel.tsx` | لوحة البنك الحالية + مرشّحات (الدرس، النوع، السنة، بحلّ) |
| `preview.tsx` + `src/lib/paginate.ts` | معاينة A4 مرقّمة، تحذيرات التجاوز، عدد الصفحات |
| `copilot-panel.tsx` | عمليات الذكاء الاصطناعي على عنصر: معاينة ← قبول/رفض |
| `templates-gallery.tsx` | قوالب Madrasadz / قوالبي / المفضّلة: استعمال/نسخ/تعديل/حفظ كقالب/مفضّلة/حذف |
| `board.tsx` | وضع السبّورة |
| `exports-menu.tsx` | PDF (موضوع/تصحيح/سلّم) × النسخ، DOCX، SVG للمنحنيات |

## 7. IMPLEMENTATION PHASES — المراحل (كل مرحلة: بناء ← اختبار ← commit)

1. **التدقيق** ✅ (هذا المستند).
2. **أساس المحرّر + مخطط الوثيقة**: `exam-blocks.ts` (الأنواع + التحقّق + التطبيع)، الهجرة 0022، الخدمة (`addBlock/updateBlock/restoreItem/updateLayout`)، الإجراءات، تصيير الكتل في الطباعة، اختبارات.
3. **تصيير الصفحات**: الورقة بالصفحات، سحب/إفلات، تراجع/إعادة، حفظ تلقائي، أدراج الهاتف.
4. **كتل الأسئلة**: محرّر التمرين الكامل (فرعيات، QCM، أشكال، سلّم)، كتلة الشعر، مساحة الإجابة.
5. **تكامل البنك**: المرشّحات الإضافية، الإدراج ككتلة قابلة للتعديل مع بقاء البيانات الوصفية (موجود) + الوضع المركّز.
6. **محرّك الرياضيات**: `math-input` + معاينة + كتلة المعادلة.
7. **محرّك المنحنيات والهندسة وجدول التغيّرات** + تصدير SVG.
8. **القوالب والترويسة**: باني الترويسة، `layout`، قوالب Madrasadz (بكالوريا رياضيات 3AS…)، المعرض.
9. **التصدير**: `marking`، فحص المجموع، DOCX، المعاينة المرقّمة، QR.
10. **AI Copilot**.
11. **مكتبة الأستاذ**: كتل محفوظة، المفضّلة، الأخيرة، المحور الموحّد `/teacher/library`.
12. **وضع السبّورة**.

## 8. TEST PLAN

- وحدات (vitest): تطبيع الكتل والتحقّق (رفض الأنواع المجهولة، حدود الأحجام)، محلّل التعابير والمنحنى (SVG يحتوي المسارات والمحاور، لا `eval`)، الهندسة، جدول التغيّرات، LaTeX→نصّ خطّي، التقسيم إلى صفحات (دالة خالصة على ارتفاعات معطاة + تحذير الكتلة الأطول من صفحة)، DOCX (الملف يُفكّ بـjszip و`document.xml` يحوي النصّ العربي و`w:bidi`)، تصيير الكتل في الطباعة (RTL، سطر مختلط عربي+LaTeX+فرنسي)، النسخ لا تخلط الكتل غير المرقّمة.
- تكامل (PGlite): إضافة/تعديل/استرجاع كتلة، أشكال داخل التمرين، تعديل الفرعيات وQCM، مراجعة تلقائية ويدوية واسترجاع، مكتبة الكتل، قالب Madrasadz ← امتحان، المفضّلة، سلّم التنقيط والمجموع ≠ 20، Copilot بمزوّد وهمي (قبول ← تطبيق).
- يدوي في المتصفح (بناء إنتاجي محلي): سيناريو PoC كاملاً — رياضيات 3AS بكالوريا: فتح المحرّر، لوحة البنك، إضافة تمرين، معادلة، منحنى، جدول، QCM، نقاط، ترويسة، قالب، نسخة التلميذ، الحلّ، سلّم التنقيط، PDF، إعادة التحميل بعد الحفظ التلقائي.

## 9. حدود صريحة (لا ادّعاء)

- PDF يبقى عبر طباعة المتصفح (HTML/CSS هو مصدر الحقيقة)؛ لا Chromium في الخادم في هذه المرحلة.
- في DOCX: المعادلات نصّ خطّي مقروء (f(x) = eˣ − x)؛ الشكل الكامل في PDF. يُذكر ذلك في الواجهة.
- لا تعرّف تلقائي على الصور (OCR) ولا بحث دلالي.

## 10. سجلّ التنفيذ

يُحدَّث في آخر كل مرحلة (انظر «التقرير النهائي» في نهاية الملف).

### سجلّ المرحلة 2–12 (2026-10-02)

- **الهجرة 0022** مطبّقة في الاختبارات (PGlite) وجاهزة للإنتاج (`npm run db:migrate` يطبّقها تلقائياً عند الإقلاع).
- **الكود الخالص:** `src/lib/exam-blocks.ts` (المخطط والتحقّق والتسميات والافتراضيات)، `graph.ts` (محلّل + راسم)، `geometry.ts`، `variation-table.ts`، `latex-text.ts`، `paginate.ts`، `marking.ts`، `exam-points.ts`، `studio-templates.ts`.
- **الخادم:** `exams.service.ts` (كتل، أشكال، فرعيات، سلّم، استرجاع عناصر، تخطيط، مفضّلة، مراجعات تلقائية)، `exam-studio.service.ts` (مراجعات، مكتبة، قوالب، Copilot)، `exam-docx.ts`، مسار `/api/v1/exams/[id]/docx`، `exam-render.ts` (تصيير الكتل، النسخ تخلط المرقّم فقط)، مزوّدا OpenAI/Anthropic: `examCopilot`.
- **الواجهة:** `src/components/studio/*` (الاستوديو، الورقة، بطاقات العناصر والكتل، محرّرات الكتل، إدخال الرياضيات، الشريط، البنك، الترويسة، النقاط، المعاينة A4، المساعد، المراجعات، القوالب، المكتبة، السبّورة)، صفحات `/teacher/exams/templates`، `/teacher/library`، `/teacher/exams/[id]/board`، صفحة الطباعة بوضع `marking`.
- **الاختبارات:** `tests/exam-studio.test.ts` (14 اختباراً) + كل الاختبارات السابقة.

---

## التقرير النهائي (2026-10-02)

### DONE
- **أساس المحرّر ومخطط الوثيقة:** `exam_items` = كتل مرتّبة؛ نوع `BLOCK` بـ12 نوع كتلة (عنوان، فقرة، معادلة، منحنى، شكل هندسي، جدول، جدول تغيّرات، شعر صدر|عجز، صورة، مساحة إجابة، فاصل، ملاحظة) + أشكال داخل التمرين (`snapshot.figures`). الصفحات تُشتقّ من `PAGE_BREAK`.
- **الورقة:** صفحات مرقّمة، سحب/إفلات (عناصر، بنك، كتل، مكتبة)، تحرير في المكان بحفظ تلقائي، تراجع/إعادة حقيقيان (Ctrl+Z/Y) بإجراءات معاكسة في الخادم، مؤشّر «محفوظ/يُحفظ/تعذّر»، أدراج للهاتف.
- **كتل الأسئلة:** تمرين/سؤال بأسئلة فرعية (إضافة/حذف/ترتيب/نقاط/حلّ)، QCM (اختيارات، صحيح، أعمدة 1–4)، أشكال داخل التمرين، سلّم تنقيط تفصيلي، صعوبة وزمن.
- **البنك:** اللوحة الحالية + مرشّحات (الدرس، النوع، بحلّ) + الوضع المركّز/الكامل؛ الإدراج ككتلة قابلة للتعديل مع بقاء المصدر والبيانات الوصفية (النسخة المجمّدة الموجودة).
- **الرياضيات:** حقل بلوحة LaTeX (كسر، جذر، نهاية، تكامل، مجموعات، أشعة، أنظمة…) ومعاينة KaTeX في المتصفح؛ الطباعة بـKaTeX في الخادم كما كانت.
- **المنحنيات والهندسة:** محلّل تعابير آمن (بلا eval) يقبل LaTeX بسيطاً، راسم SVG (محاور، تدريج، شبكة، O/i/j، مقاربات، نقاط، مفتاح، قطع عند الانقطاع)، أشكال هندسية (نقاط/قطع/دوائر/مضلّعات/زوايا قائمة)، جدول تغيّرات بالأسهم. نفس SVG في المحرّر والطباعة وWord.
- **القوالب والترويسة:** 5 قوالب Madrasadz (بكالوريا رياضيات علوم تجريبية، رياضيات/تقني رياضي، اختبار فصلي، فرض، بكالوريا عربية آداب) + قوالبي + المفضّلة (استعمال/نسخ/تعديل/حفظ كقالب/مفضّلة/حذف). باني الترويسة: 4 تخطيطات، الجمهورية/الوزارة/المديرية، حقول التلميذ، التاريخ، الشعار، QR، التذييل وترقيم الصفحات، الخطّ والهوامش، ترقيم التمارين؛ ترويسات محفوظة في المكتبة.
- **التصدير:** الموضوع/التصحيح/**سلّم التنقيط** (نسخة ثالثة بفحص المجموع ≠ 20 والفرعيات) × النسخ A–D (تخلط المرقّم فقط؛ الكتل ثابتة)، **Word (.docx)** من اليمين لليسار، معاينة A4 مرقّمة بتحذيرات التجاوز.
- **AI Copilot:** 11 عملية (أسهل/أصعب/مشابه/إعادة صياغة/حلّ/سلّم/مشتّتات/تحويل QCM/أسئلة فرعية/نقاط/زمن) بمعاينة ثم قبول (تعديل قابل للتراجع) أو رفض؛ المفتاح في الخادم، حدّ طلبات، تسجيل الاستهلاك، لا يُكتب شيء قبل القبول.
- **المراجعات:** لقطة تلقائية قبل أول تغيير كل 10 دقائق (حدّ 40)، يدوية بعنوان، استرجاع يحفظ الحالة الحالية أولاً.
- **مكتبتي:** `/teacher/library` (أسئلتي، امتحاناتي، قوالبي، كتلي، المفضّلة، الأخيرة) + حفظ أي كتلة/ترويسة من الورقة.
- **السبّورة:** `/teacher/exams/[id]/board` (عنصر عنصراً، تكبير، داكن، إظهار الحلّ، لوحة المفاتيح).

### PARTIALLY DONE
- **PDF:** عبر طباعة المتصفح (HTML/CSS مصدر الحقيقة) كما كان؛ لا Chromium في الخادم. المعاينة المرقّمة تقدير قريب (الطابعة تقسم الكتل الطويلة وحدها).
- **Word:** المعادلات نصّاً خطّياً بيونيكود (f(x) = eˣ − x)؛ المنحنيات والأشكال الهندسية إشارة نصّية «انظر PDF» (لا تحويل SVG→صورة في الخادم)؛ الصور png/jpeg فقط (webp لا يدعمه Word).
- **القوالب:** رياضيات 3AS + عربية آداب؛ بقية المواد تستعمل القوالب الشخصية أو «ابنِ لي الامتحان».
- **الأداء:** تحميل كسول لـKaTeX والمعاينة؛ لا virtualization (الورقة ≤ 60 عنصراً).

### NOT DONE
- OCR للصور، بحث دلالي، كتلة عمودين، سحب الأشكال داخل التمرين (تُدار من محرّر التمرين)، SVG للمنحنى كملف منفصل (موجود داخل الصفحة فقط).

### FILES CHANGED (أهمّها)
- جديد: `src/lib/{exam-blocks,graph,geometry,variation-table,latex-text,paginate,marking,exam-points,exam-labels,studio-templates}.ts`، `src/server/db/schema/studio.ts`، `src/server/services/exam-studio.service.ts`، `src/server/actions/studio.actions.ts`، `src/server/lib/exam-docx.ts`، `src/components/studio/*` (15 مكوّناً)، `tests/exam-studio.test.ts`.
- معدَّل: `exams.service.ts`، `exams.actions.ts`، `exam-render.ts`، `exam-print.tsx`، `print-toolbar.tsx`، `print/exams/[id]/page.tsx`، `teacher/exams/page.tsx`، `teacher/exams/[id]/page.tsx`، `ai/{types,shared,openai-provider,anthropic-provider}.ts`، `schema/{enums,exams,index}.ts`، `nav.ts`، `i18n/ar.ts`.
- محذوف: `src/components/domain/exam-builder.tsx` (حلّ محلّه الاستوديو في المسار نفسه).

### MIGRATIONS
- `drizzle/0022_exam_studio.sql` (+ `drizzle/down/0022_exam_studio.down.sql`): إضافات فقط. تُطبَّق تلقائياً عند الإقلاع (`db:migrate`).

### NEW ROUTES
- `/teacher/exams/templates` · `/teacher/library` · `/teacher/exams/[id]/board` · `/api/v1/exams/[id]/docx?mode=subject|correction|marking&variant=A..D` · `/print/exams/[id]?mode=marking`.

### NEW COMPONENTS
- `studio.tsx` (الغلاف)، `paper.tsx`، `item-card.tsx`، `block-card.tsx`، `block-editors.tsx`، `block-view.tsx`، `math-input.tsx`، `block-library.tsx`، `bank-panel.tsx`، `settings-panel.tsx`، `header-builder.tsx`، `preview.tsx`، `copilot-panel.tsx`، `templates-gallery.tsx`، `library-blocks.tsx`، `board.tsx`.

### HOW TO TEST
1. `npm test` (268 اختباراً)، `npm run typecheck`، `npm run lint`.
2. `npm run build && npm start` ثم بحساب أستاذ: **الامتحانات ← القوالب ← «بكالوريا تجريبية — رياضيات 3 علوم تجريبية» ← استعمال**.
3. في الاستوديو: أضف معادلة ومنحنى (غيّر الدالة إلى `x^2-2x`) وجدولاً وسؤال QCM؛ جرّب Ctrl+Z/Ctrl+Y؛ «إعادة توزيع النقاط على 20»؛ تبويب الترويسة: مؤطّر + حقول التلميذ + حفظ؛ زرّ ✨ على تمرين (يحتاج مفتاح ذكاء اصطناعي) ← الحلّ النموذجي ← قبول؛ «معاينة A4»؛ «المراجعات» ← حفظ واسترجاع؛ «حفظ في مكتبتي» على كتلة.
4. التصدير: الموضوع/التصحيح/السلّم بالنسخة B، وWord الموضوع. ثم السبّورة، ومكتبتي، وإعادة تحميل الصفحة (كل شيء محفوظ)، وعرض الهاتف (الشريط السفلي).
5. سيناريو آلي كامل بالمتصفح: `studio-check.mjs` (Playwright) — 30 فحصاً تمرّ.

### NEXT PRIORITY
1. تحويل SVG إلى PNG في الخادم (resvg-wasm) لتضمين المنحنيات في Word، وPDF خادمي اختياري.
2. قوالب Madrasadz لبقية المواد (فيزياء، علوم، فلسفة، لغات) وترويسات ولائية.
3. Copilot على مستوى الورقة (توازن الصعوبة، زمن إجمالي) وتعميم المحرّك على مواد أخرى.
