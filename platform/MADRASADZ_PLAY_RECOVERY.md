# MADRASADZ PLAY — تقرير الاستعادة (M1) — 2026-10-23

## النتيجة: **استُعيد كاملاً**

- البحث: `git ls-remote` على GitHub (لا فرع play صباحاً) → فحص سجلّ الجلسات السابقة → تعذّر الوصول إلى مساحة عمل الجلسة القديمة من هنا → طُلب من المالك إرسال أمر دفع داخل تلك الجلسة.
- 13:16 — ظهر الفرع `madrasadz-play` على GitHub بـSHA `ffd5a68f18ed96d43aafdf4d90c664c16257ac03` (8 commits: `2a294b5` المحرك والمخطط والاختبارات، `9c51028` الواجهة وأول 1000 سؤال، ثم موجات المحتوى 1→6).
- التحقق المستقل هنا (لا من التقرير): `scripts/play/validate.ts` → **4147/4147 صالح، 0 تكرارات** · `tests/play.test.ts` → 11/11 · `tsc` → نجاح.

## ما استُعيد

| العنصر | الموضع |
|---|---|
| مخطط `play_*` (11 جدولاً) + هجرة | `src/server/db/schema/play.ts`، `drizzle/0026_madrasadz_play.sql` (كانت 0008) |
| محرك اللعب (تصحيح على الخادم، XP، Leitner) | `src/server/play/{constants,engine,importer,question-types}.ts` |
| الخدمات والأفعال | `src/server/services/play.service.ts`, `play-admin.service.ts`, `src/server/actions/play.actions.ts` |
| واجهة التلميذ + صفحة عامة | `src/app/student/play/**`, `src/app/(public)/play`, `src/components/play/*` |
| مصنع الأسئلة | `content/play/AUTHORING.md`, `catalog.json`, `coverage-map.json`, `scripts/play/validate.ts` |
| البنك | `content/play/<grade>/<subject>/Txxx.json` — 4147 سؤالاً (MCQ 2518 · FILL_BLANK 1629) |

## ما لم يُستعد / لم يكن موجوداً أصلاً

- مجلد مهام التأليف المؤقت (`tasks/T*.json`, `make_prompt.py`) — كان خارج المستودع؛ المهام المتبقية (T087–T104، 18 مهمة ≈ 853 سؤالاً لـ3AS) تُشتق من `coverage-map.json`.
- لوحة `/admin/play`، سكربت `scripts/play/import.ts`، GAME 3/4 — لم تُبنَ بعد (كما في سجل التقدم).

## الدمج على `work`

الفرع كان مبنياً على `main` القديم. دُمج في `feature/madrasadz-play-recovery-2026` (المشتق من `work`) بـcommit `a3112b4`:
- تعارضات: `package.json` (أُبقيت نسخ `work`: katex 0.16.47)، `nav.ts`/`schema/index.ts`/`tailwind.config.ts` (اتحاد الطرفين)، `drizzle/meta/_journal.json` + `0008_snapshot.json` (أُبقي `work` وأُضيف إدخال `0026`).
- أُضيف `drizzle/down/0026_madrasadz_play.down.sql`.
- لا حذف لأي ملف أو بيانات؛ `main` و`work` و`madrasadz-play` لم تُمسّ.
