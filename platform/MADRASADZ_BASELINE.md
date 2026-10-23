# MADRASADZ — خط الأساس (M0) — 2026-10-23

> كل رقم هنا مأخوذ من أمر نُفِّذ فعلاً (مذكور بجانبه). ما لم يُنفَّذ مكتوب صراحةً «لم يُتحقَّق».

## 1. الفروع على GitHub (`git ls-remote`)

| الفرع | SHA | آخر commit | ملاحظة |
|---|---|---|---|
| `work` | `eecbebf` | 2026-10-12 «bac import: never freezes…» | **القاعدة المعتمدة**: 80 commit فوق `main`، فيه كل ميزات الموقع (الأقسام الستة، المنتدى، بنك البكالوريا، صفحة نشر، المتجر، استوديو الاختبارات…) |
| `main` | `f533fe3` | 2026-10-15 «Add 988 QCM questions…» | متأخر عن `work` (افترقا عند `51bda1a` 2026-09-18)؛ commit واحد فقط ليس في `work` (بنك 988) |
| `madrasadz-play` | `ffd5a68` | 2026-10-23 «play: content wave 6…» | دُفع من الجلسة القديمة؛ 8 commits فوق `main`؛ **لا يحوي `work`** |
| `claude/arabic-edtech-platform-wfcst1` | `eecbebf` | = `work` | اسم الفرع الذي ينشر منه الخادم حسب جلسة 2026-10-02 |
| `feature/madrasadz-play-recovery-2026` | — | فرع هذا العمل | `work` + دمج `madrasadz-play` |

أوامر: `git rev-list --count origin/main..origin/work` → 80 · `git rev-list --count origin/work..origin/main` → 1 · `git merge-base --is-ancestor origin/work origin/madrasadz-play` → لا.

## 2. المشروع (`platform/`)

- Next.js 15.5 · React 19.2 · Tailwind 3.4 · Drizzle 0.45 · PGlite 0.5 (محلياً/اختبارات) · Postgres (إنتاج). `package.json`.
- الهجرات: `drizzle/0000_init.sql` … `0025_upload_batches.sql` (26 هجرة على `work`) + `down/` لكل واحدة. **ملاحظة**: `madrasadz-play` كان يسمّي هجرته `0008_madrasadz_play.sql` بينما `0008` على `work` هي `bac_and_model_answer` → أُعيد ترقيمها **0026** عند الدمج.
- الجداول: 90+ جدولاً (`grep -c pgTable src/server/db/schema/*.ts`)، منها بنك الأسئلة `bank_questions` + التدريب الذاتي `practice_*` + التقدّم `student_node_progress`، وبعد الدمج 11 جدول `play_*`.
- المسارات: 151 صفحة `page.tsx` على `work` (عامة 33، تلميذ 23، أستاذ 70، إدارة 22، مساعد 9) + صفحات PLAY بعد الدمج.
- الاختبارات: 69 ملفاً في `tests/` (vitest على PGlite في الذاكرة، تسلسلي).

## 3. الفحص على `work` قبل أي تعديل

- `npm ci` → 595 حزمة، نجاح.
- `npx tsc --noEmit` → **نجاح** (exit 0).
- `npx vitest run` (كاملة) → نُفِّذت أثناء الدمج فتلوّثت 15 نتيجة بملف `_journal.json` وهو في حالة تعارض؛ **أُعيد تشغيلها على الشجرة المدمجة** (النتيجة في `MADRASADZ_PROGRESS.md`).

## 4. الفحص بعد دمج PLAY على `work` (commit `a3112b4`)

- `npx tsc --noEmit` → نجاح.
- `vitest run tests/play.test.ts tests/practice.test.ts tests/quizzes.test.ts tests/bootstrap.test.ts` → 24/24.
- `npx tsx scripts/play/validate.ts` → **4147/4147 صالح، 0 تكرارات**.
- اختبار `activity-labels` كشف 6 أحداث PLAY بلا ترجمة → أُصلحت (`src/i18n/ar.ts`).

## 5. بنك 988 (main `f533fe3`, `platform/content/qcm/*.json`)

- 21 ملفاً، 988 سؤال MCQ، كلها بـ4 خيارات وإجابة واحدة وشرح. فحص آلي (`qcm_stats.py`): 0 مشكلات بنيوية، توزيع الإجابة الصحيحة متوازن (252/249/240/247).
- تكرار: 5 أسئلة متطابقة النص بعد التطبيع؛ 3 منها تكرار دلالي حقيقي (استُبعدت)، و2 يختلف محتواهما فأُبقيت → **985** مرشّحاً.
- المواضيع: إعراب المفردات 200 · إعراب الجمل 200 · الأساليب 200 · الصور البيانية 193 · المحسنات 95 · الإحالة 100 → تُطابق دروس PLAY `3AS/AR/U3/L1–L6`.
- سكربت `import-qcm-bank.ts` القديم يُدخلها كاختبارات `quizzes` ويحذف الشرح → **لن يُستعمل**؛ البديل: إدخالها في PLAY (مع الشرح) بعد التدقيق العلمي.

## 6. الخادم (Contabo) — **لم يُتحقَّق**

لا وصول SSH من هذه الجلسة. ما هو معروف من جلسات سابقة فقط: Docker Compose (`docker-compose.prod.yml` + edge/Caddy)، نشر من فرع `claude/arabic-edtech-platform-wfcst1`، خادم مشترك مع novalane.uk وaqlitrade.com، fail2ban مثبَّت (2026-10-20). قبل أي نشر: مقارنة `git rev-parse HEAD` على الخادم مع `eecbebf`.

## 7. المخاطر المعروفة

1. **أمني (عالٍ، لم يُصلح)**: صفحة «ملفاتي» تعطي التلميذ روابط تحميل مباشرة لملفات/فيديوهات محمية (تقرير 2026-10-20). يُفحص في M6 قبل أي نشر.
2. التسجيل لا يميّز الأستاذ عن التلميذ.
3. الخادم بلا وكيل Cloudflare؛ إعداد مفاتيح SSH لم يكتمل.
4. الاختلاف بين الفرع المنشور وما على GitHub غير مؤكَّد (قد يحوي الخادم تعديلات غير مدفوعة كما حدث في NOVA).
