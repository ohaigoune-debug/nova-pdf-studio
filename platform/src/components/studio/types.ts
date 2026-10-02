import type { ExamItemRow } from '@/server/db/schema'

export type Result = { ok: boolean; error?: { message: string } } & Record<string, unknown>

/** إجراء قابل للتراجع: ما يعيد الحالة السابقة وما يعيد تطبيق التغيير */
export interface UndoEntry {
  label: string
  undo: () => Promise<Result>
  redo: () => Promise<Result>
}

/** تنفيذ إجراء خادمي مع رسالة نجاح وتسجيل في مكدّس التراجع */
export type Run = (fn: () => Promise<Result>, ok?: string | null, undo?: UndoEntry) => void

export type Opt = { id: string; name: string }

/** حالة عنصر كما تُرسل إلى restoreItemsAction (للتراجع) */
export function stateOf(it: ExamItemRow, position?: number | null) {
  return { itemId: it.id, kind: it.kind as 'EXERCISE' | 'QUESTION' | 'TEXT' | 'PAGE_BREAK' | 'BLOCK', bankQuestionId: it.bankQuestionId, title: it.title, points: it.points == null ? null : Number(it.points), snapshot: it.snapshot, position: position ?? null }
}
