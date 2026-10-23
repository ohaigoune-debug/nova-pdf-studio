# MADRASADZ — سجلّ التقدّم (يُحدَّث بعد كل مرحلة)

> من يستأنف العمل يبدأ من هنا، ثم `MADRASADZ_BASELINE.md` و`MADRASADZ_PLAY_RECOVERY.md` و`MADRASADZ_PLAY_PROGRESS.md`.

## الحالة — 2026-10-23

- **الفرع**: `feature/madrasadz-play-recovery-2026` (مشتق من `work` `eecbebf` + دمج `madrasadz-play` `ffd5a68`). مدفوع إلى GitHub. لا دمج في `work`/`main` ولا نشر بعد.
- **آخر commit**: انظر `git log -1`.
- **المرحلة الحالية**: M4 (إكمال البنك) + M5 (لوحة الإدارة) بالتوازي.

| المرحلة | الحالة | الدليل |
|---|---|---|
| M0 Audit & Baseline | ✅ | `MADRASADZ_BASELINE.md` |
| M1 PLAY Recovery | ✅ | `MADRASADZ_PLAY_RECOVERY.md`، commit `a3112b4` |
| M2 Legacy QCM (988) | ✅ | دُقّق علمياً (985: 850 سليم، 120 مُصحَّح ووُسم للمراجعة، 15 مرفوض) → `content/play/3AS/AR/BL-L1..L6.json` (970 سؤالاً)؛ التقرير `BL-AUDIT-REPORT.json` |
| M3 Game Engine | ✅ (MCQ + FILL_BLANK) | `tests/play.test.ts` 11/11؛ GAME 3/4 مؤجّلان |
| M4 Question Bank | ✅ | **5969** صالح، 0 تكرار (`npm run play:validate`): 4999 PLAY + 970 من بنك 988 |
| M5 Admin & Analytics | ✅ | `scripts/play/import.ts` + `/admin/play` (commit d3b0120) |
| M6 Security & QA | ✅ | ثغرة «ملفاتي» أُصلحت؛ vitest 382/382 (77 ملفاً) قبل إدخال 988؛ tsc نظيف؛ lint بلا أخطاء |
| M7 Release Candidate | ✅ | `docs/RELEASE_PLAY_ACADEMY.md` (نسخة احتياطية، سحب، بناء، هجرات 0026–0028، استيراد dry-run، تراجع) |
| M8 Academy | ✅ منفَّذ | OTP/المتجر، الدورات والاشتراكات، webhook التوصيل والمطالبة، الشكاوى، Bunny، البث المباشر — commits 53beea6…d57dff1 |

## أعداد الأسئلة (حسب تعريف البرومبت)

| | العدد | المصدر |
|---|---|---|
| خام مسترجَع | 4147 (PLAY) + 988 (QCM) | validate.ts · qcm_stats |
| فريد بعد إزالة التكرار | 4635 (PLAY بعد موجة 7) + 985 (QCM) | validate.ts (0 تكرار) · 3 مكرّرات دلالية حُذفت من QCM |
| اجتاز التدقيق الآلي | 4635 | validate.ts |
| معتمد للنشر (APPROVED/PUBLISHED) | 0 | لا اعتماد تلقائي؛ يتم من `/admin/play` |

## ما بقي

1. استلام نتائج تدقيق 988 → توليد `content/play/3AS/AR/BL-L*.json` → validate → commit.
2. موجة 8 → validate → commit → تحديث `MADRASADZ_PLAY_PROGRESS.md`.
3. `/admin/play` → tsc/lint/tests → commit.
4. M6: فحص ثغرة «ملفاتي» وإصلاحها باختبارات؛ lint كامل؛ vitest كامل؛ رحلة طالب على الهاتف (تحتاج الخادم أو جهازاً).
5. M7: PR من الفرع إلى `work` (لا إلى `main`)، خطة نشر وتراجع (`drizzle/down/0026_madrasadz_play.down.sql`).
6. M8: وثيقة خارطة الأكاديمية المدفوعة.

## مشكلات مفتوحة

- نتائج `vitest run` الكاملة على الشجرة المدمجة: جارية (الدفعة الأولى تلوّثت بالدمج أثناء التشغيل).
- ثغرة «ملفاتي» (عالية) غير مُصلحة بعد.
