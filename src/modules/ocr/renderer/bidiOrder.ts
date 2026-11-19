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

/** مقطع عربي: حروف عربية مع المسافات وعلامات الترقيم العربية بينها. */
const ARABIC_RUN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF](?:[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF ]*[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF])?/g

export function prepareArabicRunForFontkit(text: string): string {
  if (!ARABIC.test(text)) return text
  // سطر يبدأ بالعربية: fontkit يعكس السطر كله ← نعكس مسبقًا مقاطع الأرقام/اللاتيني فقط
  if (fontkitTreatsAsRtl(text)) return text.replace(LTR_RUN, (run) => [...run].reverse().join(''))
  // سطر يبدأ باللاتينية وفيه عربية: fontkit لا يعكس شيئًا ← نعكس المقاطع العربية لتصبح بالترتيب البصري
  return text.replace(ARABIC_RUN, (run) => [...run].reverse().join(''))
}

export interface ScriptSegment {
  text: string
  font: 'arabic' | 'latin'
}

/**
 * يقسم سطرًا مختلطًا إلى مقاطع حسب الخط القادر على رسمها: الخط العربي (Noto Naskh) لا يحوي الحروف اللاتينية
 * ولا «- / % ( )»، فكانت الكلمات اللاتينية داخل سطر عربي تضيع من طبقة البحث. التقسيم على مستوى الكلمات:
 * كلمة فيها عربية ← عربي؛ كلمة يرسمها الخطان (أرقام، «: , .») ← تلتحق بالمقطع السابق؛ غير ذلك ← لاتيني.
 * تُعاد المقاطع بالترتيب المنطقي، مع اتجاه السطر (rtl إن كان أول حرف قوي عربيًا).
 */
export function segmentMixedLine(text: string, arabicFontHas: (codePoint: number) => boolean, latinEncodable: (s: string) => boolean): { rtl: boolean; segments: ScriptSegment[] } {
  const tokens = text.split(/(\s+)/).filter((t) => t.length > 0)
  type Cls = 'arabic' | 'latin' | 'neutral' | 'space' | 'drop'
  const classify = (tok: string): Cls => {
    if (/^\s+$/.test(tok)) return 'space'
    if (ARABIC.test(tok)) return 'arabic'
    if ([...tok].every((c) => arabicFontHas(c.codePointAt(0)!))) return 'neutral'
    return latinEncodable(tok) ? 'latin' : 'drop'
  }
  const segments: ScriptSegment[] = []
  let pending = '' // محايدات في بداية السطر تنتظر أول مقطع قوي
  for (const tok of tokens) {
    const cls = classify(tok)
    if (cls === 'drop') continue
    const last = segments[segments.length - 1]
    if (cls === 'space' || cls === 'neutral') {
      if (last) last.text += tok
      else pending += tok
      continue
    }
    if (last && last.font === cls) last.text += tok
    else {
      segments.push({ text: pending + tok, font: cls })
      pending = ''
    }
  }
  if (pending.trim() && segments.length === 0) segments.push({ text: pending, font: 'arabic' })
  for (const s of segments) s.text = s.text.replace(/\s+$/, '')
  return { rtl: fontkitTreatsAsRtl(text), segments: segments.filter((s) => s.text.trim()) }
}
