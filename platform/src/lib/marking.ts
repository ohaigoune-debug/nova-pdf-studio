/** نسخة سلّم التنقيط: نقاط كل عنصر وفرعياته وسلّمه، وفحص المجموع مقابل المستهدف (20 عادة) — دالة خالصة */
import type { ExamItemRow } from '@/server/db/schema/exams'
import { itemPoints } from './exam-points'

export interface MarkingRow {
  itemId: string
  label: string
  points: number
  children: { body: string; points: number; bareme: { label: string; points: number }[] }[]
  bareme: { label: string; points: number }[]
  /** مجموع الفرعيات/السلّم لا يساوي نقاط العنصر */
  mismatch: boolean
}

export interface MarkingSummary {
  rows: MarkingRow[]
  total: number
  target: number
  ok: boolean
  warnings: string[]
}

export function markingSummary(view: { items: ExamItemRow[]; numbering: Record<string, string>; targetPoints: string | number }): MarkingSummary {
  const rows: MarkingRow[] = []
  const warnings: string[] = []
  const r2 = (n: number) => Math.round(n * 100) / 100
  for (const it of view.items) {
    if (it.kind !== 'EXERCISE' && it.kind !== 'QUESTION') continue
    const s = it.snapshot
    const pts = itemPoints(it)
    const children = (s.children ?? []).map((c) => ({ body: c.body, points: c.points ?? 0, bareme: c.bareme ?? [] }))
    const sub = children.length ? r2(children.reduce((a, c) => a + c.points, 0)) : null
    const baremeSum = s.bareme?.length ? r2(s.bareme.reduce((a, b) => a + b.points, 0)) : null
    const mismatch = (sub != null && sub !== pts) || (baremeSum != null && baremeSum !== pts)
    if (mismatch) warnings.push(`${view.numbering[it.id] ?? ''}: مجموع الفرعيات/السلّم (${sub ?? baremeSum}) لا يساوي نقاط العنصر (${pts})`)
    rows.push({ itemId: it.id, label: view.numbering[it.id] ?? '', points: pts, children, bareme: s.bareme ?? [], mismatch })
  }
  const total = r2(rows.reduce((a, r) => a + r.points, 0))
  const target = Number(view.targetPoints)
  if (total !== target) warnings.unshift(`المجموع ${total} لا يساوي ${target}`)
  return { rows, total, target, ok: total === target && !rows.some((r) => r.mismatch), warnings }
}
