/**
 * نصوص PDF العربية تخرج كثيراً «بترتيب العرض» لا بترتيب القراءة: الأسطر مقلوبة حرفاً حرفاً
 * («ةينايبلا روصلا» بدل «الصور البيانية»)، وأحياناً تُصحَّح بعض الكلمات دون غيرها.
 * لا معجم هنا: علامات لا تخطئ في العربية — لا كلمة تبدأ بتاء مربوطة أو ألف مقصورة،
 * و«ال» في أوّل الكلمة لا في آخرها — تكفي لمعرفة اتجاه السطر ثم الكلمة.
 */
const AR = /[؀-ۿ]/
const WORD = /[؀-ۿ]+/g

/** موجب ⇒ مقلوبة على الأرجح، سالب ⇒ سليمة، صفر ⇒ لا دليل */
function wordScore(w: string): number {
  if (w.length < 3) return 0
  let s = 0
  if (/^[ةى]/.test(w)) s += 3
  if (/[ةى]$/.test(w)) s -= 2
  if (/^(و|ف|ب|ك)?ال/.test(w) && w.length > 3) s -= 2
  // «ال» التعريف مقلوبة تصير «لا» في آخر الكلمة (وزن أخفّ: «مثلا» و«أولا» سليمتان)
  if (/لا$/.test(w) && w.length > 3) s += 1
  if (/^ء/.test(w)) s += 1
  return s
}

const reverse = (s: string) => [...s].reverse().join('')

function fixLine(line: string): string {
  if (!AR.test(line)) return line
  const words = line.match(WORD) ?? []
  const score = words.reduce((n, w) => n + wordScore(w), 0)
  let out = line
  if (score > 0) {
    // قلب السطر كلّه يعيد ترتيب الكلمات والحروف معاً؛ ثم تُعاد الأرقام واللاتينية إلى اتجاهها
    out = reverse(line).replace(/[0-9A-Za-z][0-9A-Za-z.,:/%-]*[0-9A-Za-z]|[0-9A-Za-z]/g, (m) => reverse(m))
      // «لا» و«لأ» حرف مركّب يخرج بترتيبه المنطقي داخل السطر المقلوب، فينعكس بعد القلب:
      // «األصلي» ← «الأصلي»، «االستعارة» ← «الاستعارة» (ألفان متتاليان أو «األ» لا يقعان في العربية)
      .replace(/ا([أإآ])ل/g, 'ال$1')
      .replace(/اال/g, 'الا')
  }
  // وكلمة كانت سليمة قبل القلب صارت مقلوبة: تُصحَّح وحدها
  return out.replace(WORD, (w) => {
    const fixed = wordScore(w) >= 3 ? reverse(w) : w
    // التاء المربوطة لا تقع إلا آخر الكلمة: «استعاةر» ← «استعارة»
    return fixed.replace(/ة([^ة])$/, '$1ة')
  })
}

export function fixArabicPdfOrder(text: string): string {
  return text.split('\n').map(fixLine).join('\n')
}
