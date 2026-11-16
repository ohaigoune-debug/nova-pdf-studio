/**
 * ترتيب النص قبل تمريره إلى fontkit عند الكتابة بخط عربي في طبقة النص الخفية.
 *
 * fontkit يعكس سلسلة الحروف كاملةً إذا كان أول حرف «قوي» عربيًا (اتجاه rtl)، فتنعكس معها الأرقام والكلمات اللاتينية
 * داخل السطر العربي، ثم يعيد pdf.js (وأي قارئ PDF) ترتيبها عند الاستخراج فتظهر الأرقام مقلوبة (12500 → 00521).
 * الحل: نعكس كل مقطع LTR (أرقام/لاتيني) مسبقًا، فيعيده انعكاس fontkit إلى ترتيبه الصحيح بصريًا،
 * ويصبح تدفق الرموز في الملف بالترتيب البصري القياسي الذي تتوقعه القارئات.
 */
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/
const LATIN_OR_DIGIT = /[0-9A-Za-zÀ-ɏ]/
/** مقطع LTR: يبدأ وينتهي بحرف لاتيني/رقم، ويمكن أن يحوي بينهما مسافات وعلامات الأرقام (12 500,00 / 2026-015 / 10:30). */
const LTR_RUN = /[0-9A-Za-zÀ-ɏ](?:[0-9A-Za-zÀ-ɏ .,:/\-+%'’°]*[0-9A-Za-zÀ-ɏ%])?/g

/** هل سيعكس fontkit هذا النص؟ (أول حرف من خط «قوي» عربي) */
export function fontkitTreatsAsRtl(text: string): boolean {
  for (const ch of text) {
    if (ARABIC.test(ch)) return true
    if (LATIN_OR_DIGIT.test(ch) && !/[0-9]/.test(ch)) return false
  }
  return false
}

export function prepareArabicRunForFontkit(text: string): string {
  if (!ARABIC.test(text) || !fontkitTreatsAsRtl(text)) return text
  return text.replace(LTR_RUN, (run) => [...run].reverse().join(''))
}
