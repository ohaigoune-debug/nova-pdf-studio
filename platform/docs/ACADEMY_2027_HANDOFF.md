# MADRASADZ ACADEMY 2027 — ملف التسليم (الدفعة 1: كتالوج الدورات)

التاريخ: 2026-10-23 · الفرع: `codex/academy-course-catalog-2027` · الهدف: `work`

## 1. الفروع التي فُحصت وأساس التطوير

| الفرع | SHA | التاريخ | ملاحظة |
|---|---|---|---|
| `work` | `092809758ea628e832e387f6df32276a250e5722` | 2026-10-23 | دمج PR #1 (PLAY + الأكاديمية). يحوي نظام الدورات والاشتراكات والمتجر والحصص المباشرة. **أساس التطوير.** |
| `main` | `f533fe38bcf90f58e6d6a712558144b2cc6ee053` | 2026-10-15 | قديم: لا ملفات للدورات (`courses.service.ts`, `schema/academy.ts` غير موجودة). |
| `madrasadz-play` | `ffd5a68f18ed96d43aafdf4d90c664c16257ac03` | 2026-10-23 | محتوى PLAY فقط؛ مبني على main القديم؛ لا نظام دورات. |

سبب اختيار `work`: هو الوحيد الذي يحمل نظام الدورات/الاشتراكات/المنتجات/الحصص وهو المنشور فعليًا على الخادم. لا تعديلات محلية غير محفوظة كانت موجودة عند بدء العمل (`git status` نظيف).

لا يوجد `AGENTS.md` في المستودع. آليات CI: ملف واحد `.github/workflows/android.yml` يعمل يدويًا فقط (`workflow_dispatch`) — دفع الفرع لا يشغّل أي بناء أو نشر. لا نشر تلقائي على الخادم (النشر يدوي عبر SSH وفق `docs/RELEASE_PLAY_ACADEMY.md`).

## 2. السبب الجذري لاختفاء الدورات

المسار: الإدارة تنشئ الدورة (`createCourse` → فوج خلفي + `courses.status = PUBLISHED`) → واجهة التلميذ `src/app/student/courses/page.tsx` تستدعي **`myCourses(db, actor)` فقط** (`courses.service.ts`) وهي تبدأ من `course_enrollments` (`.from(courseEnrollments).innerJoin(courses…)`) → أي دورة لا يملك التلميذ فيها صفّ اشتراك لا تُعرض إطلاقًا. وصفحة الدورة `[slug]/page.tsx` تستدعي `courseHome` التي ترمي `COURSE_NOT_FOUND` لغير المشترك (`activeEnrollmentFor` → null) فتعرض 404 أو تعيد التوجيه.

الخلاصة: لم يكن هناك أي استعلام «اكتشاف» للدورات؛ كان الاكتشاف والوصول دالةً واحدة.

## 3. الملفات المعدّلة والمضافة

| الملف | الهدف |
|---|---|
| `src/server/services/academy-catalog.service.ts` (جديد) | `listCourseCatalog`، `courseLanding` (بيانات عرض فقط)، `browseScope`/`browseOptions` (المستوى/الشعبة/المادة)، `listStudentLessonsOrganized` (ترتيب المنهاج)، `assessmentCards` (البطاقات الست)، `CATALOG_FORBIDDEN_KEYS`. |
| `src/app/student/courses/catalog/page.tsx` (جديد) | صفحة الكتالوج لكل تلميذ. |
| `src/components/academy/course-catalog-card.tsx`، `course-landing.tsx`، `scope-picker.tsx` (جديد) | بطاقة الدورة، صفحة التعريف لغير المشترك (كيف أشترك + المنتجات)، ومنتقي المستوى/الشعبة/المادة. |
| `src/app/student/courses/[slug]/page.tsx` | غير المشترك/المنتهي/الملغى يرى صفحة التعريف بدل 404/إعادة توجيه؛ المشترك الساري يصل إلى `courseHome` كما كان. |
| `src/app/student/courses/page.tsx` | روابط إلى الكتالوج (الرأس والحالة الفارغة). منطق «دوراتي» لم يتغيّر. |
| `src/components/layout/nav.ts` | مدخلا «كتالوج الدورات» و«الفروض والاختبارات» في قائمة التلميذ. |
| `src/app/student/lessons/page.tsx` | الدروس مرتّبة بأقسام المنهاج + مرشّحات؛ قسم «دروس أخرى (غير مصنّفة)». |
| `src/app/student/exams/page.tsx` (جديد) | البطاقات الست (فرض/اختبار × 3 فصول) بروابط إلى `/exams`. |
| `src/app/(public)/exams/page.tsx` | مرشّحا `term` و`stream` في الرابط + شرائح الفصول. |
| `src/server/services/library.service.ts` | `ResourceListFilter.term` و`streamId` في `listResourceCards` و`practiceCounts` (إضافة اختيارية). |
| `src/server/db/schema/content.ts` | عمودان اختياريان `subject_id`, `curriculum_node_id` + فهرسان. |
| `src/server/services/content.service.ts` | `ContentInput.subjectId/curriculumNodeId` في الإنشاء والتحديث. |
| `drizzle/0029_content_curriculum.sql` + `drizzle/down/…` + `meta/_journal.json` | الهجرة الإضافية (IF NOT EXISTS) وسكربت التراجع. |
| `tests/academy-catalog.test.ts` (جديد) | 25 اختبار انحدار (15 + 4 + 4 + 2 لجولات المراجعة). |
| `src/server/db/connect.ts` | خيار `{ migrate: false }` لأدوات الصيانة. |
| `enrollment.service.ts`, `enrollment-codes.service.ts`, `lib/errors.ts`, `i18n/ar.ts` | إغلاق رموز الانضمام لأفواج الدورات (`COURSE_GROUP_CODE`). |
| `courses.service.ts` (`runCourseAccessMigration`), `lib/course-access.ts` (النمطان + الإعداد), `scripts/academy/backfill-enrollments.ts` | إجراء الانتقال الصريح: محاكاة للقراءة فقط، إدراج ذرّي، تحقق، ثم تفعيل strict. |
| `src/server/lib/course-access.ts` (جديد) | `reachableGroupIds`/`noExpiredCourseOn`: استبعاد فوج الدورة عند كل طلب إن كان الاشتراك غير نشط أو منتهي التاريخ. |
| `content.service.ts`, `media.service.ts`, `student-extras.queries.ts`, `skills.service.ts`, `library.service.ts` (`visibleResources`) | كل بوابات الدرس/الوسائط/الملفات/الموارد تمرّ عبر `reachableGroupIds`/`noExpiredCourseOn`. |
| `src/components/domain/content-form.tsx`, `content.actions.ts`, `teacher-form-options.ts`, `teacher/content/{new,[id]/edit}` | واجهة الأستاذ: اختيار المادة وموضع الدرس في المنهاج (مسار كامل «وحدة › فصل › درس»، مرشّح بالمستوى/المادة/الشعبة). |

لم تُغيَّر عقود الدوال المشتركة: `myCourses`, `courseHome`, `enrollStudent`, `listStudentContent`, `getContentForStudent`, `resolveMediaAccess`, `visibleResources` بقيت كما هي (أُضيفت حقول اختيارية فقط لمرشّح المكتبة). الأفواج وعضوياتها وأكواد التسجيل والشروط والتفعيل لم تُمسّ.

## 4. جدول المتطلبات

| # | المطلوب | الحالة | ملاحظة |
|---|---|---|---|
| 1 | تشخيص وإصلاح اختفاء الدورات + كتالوج مستقل | ✅ منفّذ | الكتالوج يعرض المنشورة غير المحذوفة فقط، ببيانات العرض، دون منح اشتراك؛ مدخل في القائمة؛ السعر 0 لا يفتح المحتوى (الوصول يبقى عبر الاشتراك). |
| 2 | صفحة «دوراتي» | ✅ منفّذ (بلا تعديل منطق) | السلوك القائم صحيح: الساري = `ACTIVE`، المنتهي زمنيًا يُعرض `EXPIRED` رماديًا، الملغى لا يُعرض؛ ثُبّت باختبارات انحدار. |
| 3 | المحتوى المجاني دون فوج | ✅ اختبار انحدار | الحواجز (`listStudentContent`, `getContentForStudent`, `resolveMediaAccess`, `listStudentFiles`, `visibleResources`) تسمح أصلًا بـ PUBLIC/STUDENTS_ONLY بلا فوج؛ لا تعديل. GROUP_ONLY/SPECIFIC_STUDENTS لم تتغيّر. |
| 4 | اختيار المستوى/الشعبة/المادة | ✅ منفّذ | من `levels/grade_streams/subject_offerings`؛ الافتراضي من ملف التلميذ دون تعديله؛ الحالة في الرابط؛ المحتوى القديم بلا تصنيف يبقى ظاهرًا. |
| 5 | ترتيب الدروس بالمنهاج | ✅ منفّذ | الترتيب بالمسار الكامل للشجرة (CTE تكراري) لا بالأب المباشر؛ واجهة الأستاذ لاختيار المادة والعقدة مضافة. المحتوى القديم يبقى في «غير مصنّف» حتى يصنّفه الأستاذ من صفحة التعديل. |
| 6 | البطاقات الست | ✅ منفّذ | العدّ والعرض بشرط واحد (`PRACTICE_KINDS`): «فرض» = HOMEWORK، «اختبار» = TEST + EXAM، و`school_term` الحقيقي؛ واجبات الأفواج تبقى في `/student/assignments`؛ لا حلول ولا تسليمات تُعرض. |
| 7 | التوافق | ✅ منفّذ | لا تغيير في المصادقة أو المعرّفات أو مسارات API (`/api/v1/*`) أو PLAY؛ الوسائط ما زالت عبر `resolveMediaAccess` وتوقيع HMAC؛ **لم يُشغَّل Android ولا متصفح**. |
| 8 | الاختبارات والتحقق | ✅ منفّذ | انظر §5. |

### 4-ب. ملاحظات مراجعة PR #2 (عند 3409d83) — عولجت كلها
1. **الاشتراك المنتهي**: كانت البوابات تعتمد عضوية الفوج فقط حتى تمرّ مهمة الانتهاء اليومية. الآن `reachableGroupIds` يستبعد فوج الدورة عند كل طلب إن كان الاشتراك `≠ ACTIVE` أو `expires_at <= now()`، في الدرس والوسائط والملفات والمهارات والموارد (`visibleResources`). الأفواج العادية بلا دورة لا تتأثر. اختبار: «الاشتراك المنتهي زمنياً يُغلق…».
2. **ترتيب المنهاج**: CTE تكراري يبني مسار كل عقدة إلى الجذر؛ القسم = الجذر (الوحدة)، والترتيب داخل القسم بمفتاح المسار كاملًا. اختبار بشجرة «وحدة ← فصل ← درس» بترتيب يخالف الأب المباشر والعنوان.
3. **عدّ بطاقات الاختبار**: يُعدّ TEST + EXAM معًا بنفس أنواع `PRACTICE_KINDS`، والاختبار يطابق العدد مع `listResourceCards` للوجهة نفسها.
4. **الشعب المتفرّعة**: `streamFamily` (الشعبة + أمّها) في الكتالوج والدروس والبطاقات ومكتبة `/exams` (`streamIds`)؛ المحتوى الخاص بفوج يبقى محجوبًا. اختبار: TM_CIVIL يرى محتوى TM العام ولا يرى الخاص، وSCI لا ترى شيئًا منه.

### 4-ج. ملاحظات المراجعة الثانية (عند 51c894d) — عولجت كلها
1. **الوصول بلا سجل اشتراك**: `hasCourseAccessOn` يشترط الآن اشتراكًا `ACTIVE` غير منتهٍ لأي فوج تابع لدورة؛ العضوية وحدها (قديمة أو عبر رمز) لا تفتح شيئًا. مسار رموز الانضمام مغلق لأفواج الدورات في الاتجاهين (`generateCodes` و`redeemEnrollmentCode` → `COURSE_GROUP_CODE`). **التوافق الصريح**: `backfillCourseEnrollments` (+ `scripts/academy/backfill-enrollments.ts --dry-run`) ينشئ اشتراكًا MANUAL لكل عضوية نشطة بلا اشتراك؛ يشغّله المالك مرة بعد النشر — **لم يُشغَّل على الإنتاج**. الاختبار يغطي: عضوية بلا اشتراك محجوبة، الرمز القديم مرفوض، الفوج العادي يقبل الرموز، dry-run لا يكتب، التنفيذ يعيد الوصول وidempotent.
2. **البطاقات = الوجهة**: `bacExclusionClauses()` و`notAttachedSolution()` مشتركة بين `listResourceCards`/`practiceCounts`/`assessmentCards`؛ اختبار ببكالوريا رسمية 3AS لا تُعدّ ويطابق العدد العرض.
3. **منتقي المنهاج**: خيارات الشعب تحمل `parentId`، والنموذج يرشّح العقد بعائلة الشعبة (الفرع + الأم) كما في واجهة التلميذ.
4. **اتساق التصنيف**: `reconcileClassification` في `createContent`/`updateContent`: العقدة تحدّد المادة والمستوى (تُملآن إن غابا، تُرفضان إن خالفتاها)، وشعبة الدرس يجب أن تكون شعبة العقدة أو فرعًا منها؛ يُطبَّق على الحالة الناتجة عند التعديل.

### 4-د. ملاحظات الترحيل (الجولة الثالثة) — عولجت كلها
الوصول إلى فوج الدورة صار بنمطين يحدّدهما إعداد `course_access.mode` في جدول `settings` (يُقرأ داخل شرط SQL نفسه في `hasCourseAccessOn`):
- **`legacy`** (الافتراضي عند غياب الإعداد = حال الإنتاج بعد النشر): عضوية الفوج تكفي ما لم يوجد اشتراك ملغى/منتهٍ أو مضى تاريخه. **لا أحد يفقد وصولًا كان له.**
- **`strict`**: يلزم اشتراك `ACTIVE` غير منتهٍ عند كل طلب.

الإجراء الصريح `runCourseAccessMigration(db, actor, { dryRun, enableStrict })` في `courses.service.ts` + السكربت `scripts/academy/backfill-enrollments.ts`:
1. **`--dry-run`**: `createDatabase(url, { migrate: false })` (لا هجرات) + معاملة `SET TRANSACTION READ ONLY`؛ يحصر المرشّحين فقط. الاختبار يثبت أن الاتصال بلا هجرات لا يحمل مخططًا، وأن المعاملة للقراءة فقط ترفض الكتابة، وأن المحاكاة لا تغيّر صفًا ولا النمط.
2. **المرشّحون** = عضويات على أفواج الدورات بحالات `ACTIVE` و`SUSPENDED` و`SUSPENDED_DUE_TO_ABSENCE` بلا أي سجل اشتراك. لا تُمسّ حالة العضوية ولا سبب الإيقاف (اختبار يتحقق من بقاء `SUSPENDED` و`suspensionReason`).
3. **الإدراج ذرّي**: عبارة `INSERT … SELECT … WHERE NOT EXISTS … ON CONFLICT DO NOTHING` واحدة تعيد التحقق من الأهلية لحظة التنفيذ ولا تعدّل أي اشتراك موجود — لا `enrollStudent`، لا إشعارات، لا سجل زمني. اختبار السباق: اشتراك فُعِّل ثم أُلغي بين المحاكاة والتنفيذ يبقى `REVOKED` بسببه.
4. **الترتيب**: نشر (legacy) → `--dry-run` → تنفيذ → `--enable-strict` الذي يُدرج ما استجدّ ويتحقق أن المتبقي بلا اشتراك = 0 **وعندها فقط** يبدّل النمط إلى strict؛ وإلا يبقى legacy ويطبع المتبقي. اختبار يغطي السيناريو كاملًا بما فيه عضوية تظهر متأخرة.

**لم يُنفَّذ الترحيل الحقيقي ولم يُتصل بالإنتاج.** `tests/academy-catalog.test.ts` يضبط النمط strict في `beforeAll` لأن معظم اختباراته تفحص الحماية الصارمة؛ بقية الحزمة تعمل بالنمط الافتراضي legacy.

## 5. أوامر التحقق ونتائجها الحقيقية (بيئة معزولة، PGlite في الذاكرة)

```
npx tsc --noEmit                      → بلا أخطاء
npx eslint <الملفات المعدّلة>          → بلا تحذيرات
npx vitest run                        → Test Files 78 passed (78) · Tests 405 passed (405) (الجولة الثانية؛ قبلها 401 ثم 397)
DATABASE_URL=pglite://memory SESSION_SECRET=… QR_TOKEN_SECRET=… npx next build → نجح
```

اختبارات `tests/academy-catalog.test.ts` (15/15) تثبت: نشر دورة يُظهرها لغير المشترك؛ المسودة/المؤرشف/المحذوف لا تظهر؛ كائن الكتالوج والتعريف لا يحمل `groupId/termsText/fileId/body/externalUrl/youtubeId/bunnyVideoId/…`؛ غير المشترك لا يقرأ الدرس المدفوع ولا وسائطه؛ المشترك الساري يرى دورته؛ المنتهي والملغى لا يفتحان المحتوى؛ تلميذ بلا فوج يقرأ العام و«للتلاميذ» وملفاتها والفروض العامة ولا يرى موارد الأفواج؛ النطاق من الملف/الرابط لا يغيّر حساب التلميذ؛ الفلاتر لا تتجاوز الصلاحيات؛ ترتيب الوحدات والدروس بـ `sort_order` لا بالعنوان ولا بتاريخ النشر؛ البطاقات الست بأعدادها وروابطها دون كشف ملفات.

## 6. تغييرات المخطط

`0029_content_curriculum`: عمودان اختياريان على `content` (`subject_id` → `subjects`, `curriculum_node_id` → `curriculum_nodes` ON DELETE SET NULL) وفهرسان. إضافية ومتوافقة (IF NOT EXISTS)، مع سكربت تراجع. **لم تُطبَّق على أي قاعدة حقيقية**؛ تُطبَّق عند النشر فقط ضمن runbook الإصدار بعد موافقة المالك.

## 7. المخاطر والعوائق والمتبقي

- **بعد النشر (بموافقة المالك وبعد نسخة احتياطية)**: `backfill-enrollments.ts --dry-run` → بلا خيارات → `--enable-strict`. حتى تفعيل strict يبقى النمط legacy فلا يُحجب أحد؛ وبعد التفعيل تُحجب العضويات التي بلا اشتراك فقط (ولا توجد عندها لأن التفعيل مشروط بالمتبقي = 0).
- قائمة المستويات في المنتقي تعرض كل الصفوف في `levels` (12 صفًا بعد زرع المنهاج)؛ يمكن حصرها بـ `PICKER_LEVELS` لاحقًا.
- صورة غلاف الدورة في الكتالوج رابط موقّع مؤقّت (كما في «دوراتي»)؛ ليست محتوى خاصًا.
- لم يُنفَّذ: مركز التكاملات (Zoom/Bunny/CIBWEB/التوصيل/SMS) — فُحص الموجود فقط: `live.service.ts` (Zoom)، `lib/bunny.ts` + `/admin/settings/video`، `delivery.service.ts` (webhook)، `otp.service.ts` + `lib/sms.ts`، `claims.service.ts`. نقاط التوافق: التفعيل يمرّ كله عبر `enrollStudent` (idempotent) فأي بوابة دفع جديدة تستدعيها بعد التأكيد؛ الإحصائيات يمكن بناؤها على `course_enrollments` + `audit_log`.
- لم يُشغَّل Android ولا اختبار متصفح؛ الصفحات بُنيت بنجاح فقط.

## 8. النتيجة

- الفرع: `codex/academy-course-catalog-2027`
- الـ SHA النهائي: `bcc839f` (+ هذا التحديث للوثيقة)
- PR (Draft، لا دمج ولا نشر): https://github.com/ohaigoune-debug/nova-pdf-studio/pull/2
