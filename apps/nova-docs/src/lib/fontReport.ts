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
