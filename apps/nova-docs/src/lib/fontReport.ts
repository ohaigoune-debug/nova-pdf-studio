/**
 * تشخيص خطوط ملف PDF عبر pdf.js: هل الخطوط مضمّنة؟
 * ملف بخطوط عربية غير مضمّنة (Traditional Arabic، Sakkal Majalla… من Word) لا يُعرض صحيحًا على جهاز لا يملكها،
 * لا في هذا التطبيق ولا في غيره: نخبر المستخدم بالسبب وبالحل (إعادة التصدير مع تضمين الخطوط).
 */
import { OPS } from 'pdfjs-dist'

/** خطوط PDF الأربعة عشر القياسية: لا تحتاج تضمينًا (لها بيانات مدمجة في pdf.js وفي iOS) */
const STANDARD = /^(Times|Helvetica|Courier|Symbol|ZapfDingbats|Arial|TimesNewRoman|CourierNew)/i

interface FontObj { name?: string; missingFile?: boolean; isType3Font?: boolean }
interface PageLike {
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[] }>
  commonObjs: { has(id: string): boolean; get(id: string): unknown }
}

export interface FontReport { fonts: { name: string; embedded: boolean }[]; missing: string[] }

export async function fontReport(doc: { pageCount: number; page(i: number): Promise<PageLike> }, maxPages = 3): Promise<FontReport> {
  const seen = new Map<string, boolean>()
  for (let i = 0; i < Math.min(doc.pageCount, maxPages); i++) {
    const page = await doc.page(i)
    const ops = await page.getOperatorList()
    ops.fnArray.forEach((fn, k) => {
      if (fn !== OPS.setFont) return
      const id = (ops.argsArray[k] as [string])[0]
      if (!id || !page.commonObjs.has(id)) return
      const f = page.commonObjs.get(id) as FontObj
      const name = (f.name ?? id).replace(/^[A-Z]{6}\+/, '')
      if (!seen.has(name)) seen.set(name, f.isType3Font || !f.missingFile)
    })
  }
  const fonts = [...seen].map(([name, embedded]) => ({ name, embedded }))
  return { fonts, missing: fonts.filter((f) => !f.embedded && !STANDARD.test(f.name)).map((f) => f.name) }
}

export interface DocFont {
  /** المعرّف الداخلي في pdf.js (fontName في مقاطع النص) */
  id: string
  /** اسم الخط كما في الملف، بلا بادئة المجموعة الجزئية */
  name: string
  embedded: boolean
  bold: boolean
  /** أقرب خط مضمّن في التطبيق، وهل هو الخط نفسه */
  match: { family: string; exact: boolean }
  /** عدد مقاطع النص التي تستعمله (للترتيب) */
  uses: number
}

/** خطوط المستند الأكثر استعمالًا (أول صفحات قليلة) مع أقرب خط متاح للكتابة به. */
export async function documentFonts(doc: { pageCount: number; page(i: number): Promise<PageLike & { getTextContent(): Promise<{ items: unknown[] }> }> }, maxPages = 4): Promise<DocFont[]> {
  const { closestFont } = await import('./arabicRepair')
  const out = new Map<string, DocFont>()
  for (let i = 0; i < Math.min(doc.pageCount, maxPages); i++) {
    const page = await doc.page(i)
    const ops = await page.getOperatorList()
    ops.fnArray.forEach((fn, k) => {
      if (fn !== OPS.setFont) return
      const id = (ops.argsArray[k] as [string])[0]
      if (!id || out.has(id) || !page.commonObjs.has(id)) return
      const f = page.commonObjs.get(id) as FontObj & { bold?: boolean; black?: boolean }
      if (f.isType3Font) return
      const name = (f.name ?? id).replace(/^[A-Z]{6}\+/, '')
      out.set(id, { id, name, embedded: !f.missingFile, bold: !!f.bold || !!f.black || /bold|black|heavy|semibold|extrab/i.test(name), match: closestFont(name), uses: 0 })
    })
    const content = await page.getTextContent()
    for (const it of content.items as { str?: string; fontName?: string }[]) {
      const f = it.fontName && out.get(it.fontName)
      if (f && it.str?.trim()) f.uses++
    }
  }
  return [...out.values()].filter((f) => f.uses > 0).sort((a, b) => b.uses - a.uses)
}
