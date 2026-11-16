/**
 * حالة التحرير: طبقة الكائنات الأصلية (editModel من نسخة Windows) + خطوط الكتابة اليدوية + التعليقات،
 * بتاريخ تراجع/إعادة موحّد (لقطات كاملة صغيرة الحجم).
 */
import { create } from 'zustand'
import { type EditObject, newId } from '@modules/pdf/shared/editModel'
import type { InkStroke } from '../../lib/ink'
import type { NoteAnnotation } from '../../lib/annotations'

export type Tool = 'select' | 'text' | 'highlight' | 'pen' | 'signature' | 'image' | 'shape' | 'note' | 'whiteout'

export interface Snapshot {
  objects: EditObject[]
  ink: InkStroke[]
  notes: NoteAnnotation[]
}

const EMPTY: Snapshot = { objects: [], ink: [], notes: [] }

export interface PendingPlacement {
  kind: 'image'
  mime: 'image/png' | 'image/jpeg'
  dataBase64: string
  role: 'image' | 'signature'
  aspect: number   // height / width
}

interface EditorState {
  present: Snapshot
  past: Snapshot[]
  future: Snapshot[]
  tool: Tool
  color: string
  strokeWidth: number
  fontSize: number
  /** خط المحرّر المختار للنص الجديد (null = خط النظام) */
  fontName: string | null
  selectedId: string | null
  pending: PendingPlacement | null
  dirty: boolean
  reset(): void
  setTool(tool: Tool): void
  setColor(c: string): void
  setStrokeWidth(w: number): void
  setFontSize(s: number): void
  setFontName(name: string | null): void
  select(id: string | null): void
  setPending(p: PendingPlacement | null): void
  commit(next: Snapshot): void
  /** تحديث مؤقت دون تسجيل في التاريخ (أثناء السحب) */
  preview(next: Snapshot): void
  addObject(o: EditObject): void
  updateObject(id: string, patch: Partial<EditObject>, record?: boolean): void
  removeSelected(): void
  addInk(s: InkStroke): void
  addNote(n: NoteAnnotation): void
  undo(): void
  redo(): void
}

export const PALETTE = ['#111111', '#1D4ED8', '#E5484D', '#17B890', '#123D36', '#F5A524', '#FFE066', '#FFFFFF']

export const useEditor = create<EditorState>((set, get) => ({
  present: EMPTY,
  past: [],
  future: [],
  tool: 'select',
  color: '#1D4ED8',
  strokeWidth: 2.5,
  fontSize: 14,
  fontName: null,
  selectedId: null,
  pending: null,
  dirty: false,
  reset: () => set({ present: EMPTY, past: [], future: [], tool: 'select', selectedId: null, pending: null, dirty: false }),
  setTool: (tool) => set({ tool, selectedId: null, pending: tool === 'signature' || tool === 'image' ? get().pending : null }),
  setColor: (color) => {
    set({ color })
    const id = get().selectedId
    const o = get().present.objects.find((x) => x.id === id)
    if (!o) return
    if (o.kind === 'text') get().updateObject(o.id, { color } as Partial<EditObject>)
    else if (o.kind === 'rect' || o.kind === 'ellipse' || o.kind === 'line' || o.kind === 'check') get().updateObject(o.id, { stroke: color } as Partial<EditObject>)
    else if (o.kind === 'highlight') get().updateObject(o.id, { color } as Partial<EditObject>)
  },
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setFontSize: (fontSize) => {
    set({ fontSize })
    const o = get().present.objects.find((x) => x.id === get().selectedId)
    if (o?.kind === 'text') get().updateObject(o.id, { fontSize } as Partial<EditObject>)
  },
  setFontName: (fontName) => {
    set({ fontName })
    const o = get().present.objects.find((x) => x.id === get().selectedId)
    if (o?.kind === 'text') get().updateObject(o.id, { fontName: fontName ?? undefined } as Partial<EditObject>)
  },
    select: (selectedId) => set({ selectedId }),
  setPending: (pending) => set({ pending }),
  commit: (next) => set((s) => ({ past: [...s.past.slice(-99), s.present], present: next, future: [], dirty: true })),
  preview: (next) => set({ present: next }),
  addObject: (o) => {
    get().commit({ ...get().present, objects: [...get().present.objects, o] })
    set({ selectedId: o.id })
  },
  updateObject: (id, patch, record = true) => {
    const p = get().present
    const next = { ...p, objects: p.objects.map((o) => (o.id === id ? ({ ...o, ...patch } as EditObject) : o)) }
    if (record) get().commit(next)
    else get().preview(next)
  },
  removeSelected: () => {
    const id = get().selectedId
    if (!id) return
    const p = get().present
    get().commit({ objects: p.objects.filter((o) => o.id !== id), ink: p.ink.filter((s) => s.id !== id), notes: p.notes.filter((n) => n.id !== id) })
    set({ selectedId: null })
  },
  addInk: (s) => get().commit({ ...get().present, ink: [...get().present.ink, s] }),
  addNote: (n) => get().commit({ ...get().present, notes: [...get().present.notes, n] }),
  undo: () => set((s) => {
    const prev = s.past.at(-1)
    if (!prev) return s
    return { past: s.past.slice(0, -1), present: prev, future: [s.present, ...s.future], selectedId: null, dirty: true }
  }),
  redo: () => set((s) => {
    const next = s.future[0]
    if (!next) return s
    return { past: [...s.past, s.present], present: next, future: s.future.slice(1), selectedId: null, dirty: true }
  })
}))

export { newId }
