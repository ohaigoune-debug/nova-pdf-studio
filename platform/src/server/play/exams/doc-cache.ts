/**
 * مخبأ مستندات المواضيع في ذاكرة العملية — اختبار الضغط (29 أكتوبر 2026) أظهر أن قائمة البكالوريا كانت تقرأ
 * كل مواضيع المستوى كاملةً (نحو 9 ميغابايت لتلميذ 3 ثانوي في العربية) عند كل فتح، وأن صفحة الموضوع وكل إجابة
 * تقرأ الموضوع كله (نحو 90 كيلوبايت) وتعيد حساب خطواته العامّة ومقاطعها.
 *
 * المفتاح يتضمّن بصمة المحتوى (checksum): أيّ تعديل على موضوع يغيّر بصمته فيُقرأ من جديد تلقائيًّا، ولا يُقدَّم
 * محتوى قديم أبدًا. المستندات للقراءة فقط: لا يُعدَّل كائن مخبّأ في أيّ مكان (المحرّك ينسخ قبل الترتيب).
 * الحدّ 400 مستند (المعتمد اليوم 177) — يُطرد الأقدم استعمالًا.
 */
import { inArray } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { playExamSets } from '@/server/db/schema'
import type { ExamSetDocument } from './types'

const MAX_DOCS = 400
const MAX_DERIVED = 2000
const docs = new Map<string, ExamSetDocument>()
const derived = new Map<string, unknown>()

function remember<V>(m: Map<string, V>, key: string, value: V, max: number): V {
  m.delete(key)
  m.set(key, value)
  if (m.size > max) m.delete(m.keys().next().value as string)
  return value
}

const keyOf = (id: string, checksum: string) => `${id}:${checksum}`

/** مستندات المواضيع المطلوبة (بمعرّفها وبصمتها)، من المخبأ أو باستعلام واحد لما ليس فيه. */
export async function examDocuments(db: Db, refs: readonly { id: string; checksum: string }[]): Promise<Map<string, ExamSetDocument>> {
  const out = new Map<string, ExamSetDocument>()
  const missing: string[] = []
  for (const r of refs) {
    const hit = docs.get(keyOf(r.id, r.checksum))
    if (hit) {
      remember(docs, keyOf(r.id, r.checksum), hit, MAX_DOCS)
      out.set(r.id, hit)
    } else missing.push(r.id)
  }
  if (missing.length) {
    const rows = await db.select({ id: playExamSets.id, checksum: playExamSets.checksum, document: playExamSets.document }).from(playExamSets).where(inArray(playExamSets.id, [...new Set(missing)]))
    // إن تغيّرت البصمة بين الاستعلامين يُحفظ المستند ببصمته الحقيقية (الجديدة) ويُعاد هو
    for (const row of rows) out.set(row.id, remember(docs, keyOf(row.id, row.checksum), row.document, MAX_DOCS))
  }
  return out
}

export async function examDocument(db: Db, id: string, checksum: string): Promise<ExamSetDocument> {
  const doc = (await examDocuments(db, [{ id, checksum }])).get(id)
  if (!doc) throw new Error(`exam set ${id} not found`)
  return doc
}

/** قيمة مشتقّة من مستند (الخطوات العامّة لشعبة، عدد الخطوات، النقاط…) تُحسب مرّة لكلّ (موضوع، بصمة، مفتاح). */
export function examDerived<T>(id: string, checksum: string, key: string, compute: () => T): T {
  const k = `${keyOf(id, checksum)}:${key}`
  if (derived.has(k)) return remember(derived, k, derived.get(k), MAX_DERIVED) as T
  return remember(derived, k, compute(), MAX_DERIVED) as T
}

/** للاختبارات فقط */
export function clearExamDocCache(): void {
  docs.clear()
  derived.clear()
}
