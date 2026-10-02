'use client'

import { ArrowDown, ArrowUp, Check, Copy, GripVertical, Plus, RefreshCw, Scissors, Settings2, Shapes, Sparkles, Trash2, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { DIFF_AR, TYPE_AR } from '@/lib/bank-labels'
import { BLOCK_AR, defaultBlock, type BlockType, type StudioBlock } from '@/lib/exam-blocks'
import { itemPoints } from '@/lib/exam-points'
import { cn } from '@/lib/utils'
import { duplicateItemAction, removeItemAction, replaceItemAction, restoreItemsAction, updateItemAction } from '@/server/actions/exams.actions'
import type { ExamItemRow, ExamItemSnapshot } from '@/server/db/schema'
import type { ItemPatch } from '@/server/services/exams.service'
import { BlockEditor } from './block-editors'
import { MathInput } from './math-input'
import { stateOf, type Run } from './types'

const RichText = dynamic(() => import('./block-view').then((m) => m.RichText), { ssr: false })
const FiguresView = dynamic(() => import('./block-view').then((m) => m.FiguresView), { ssr: false })

const FIGURE_TYPES: BlockType[] = ['GRAPH', 'VARIATION_TABLE', 'TABLE', 'EQUATION', 'GEOMETRY', 'IMAGE']
const ARABIC_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح']

/** تمرين/سؤال/نصّ/فاصل صفحة في الورقة: عرض كما يُطبع، وتحرير كامل في مكانه */
export function ItemCard({ item, label, examId, position, assets, run, pending, onCopilot, openOnMount = false }: { item: ExamItemRow; label?: string; examId: string; position: number; assets: Record<string, string>; run: Run; pending: boolean; onCopilot?: (item: ExamItemRow) => void; openOnMount?: boolean }) {
  const [editing, setEditing] = useState(openOnMount)
  const s = item.snapshot
  const pts = itemPoints(item)
  const remove = () => {
    const state = stateOf(item, position)
    run(() => removeItemAction(examId, item.id), null, { label: `حذف ${label ?? 'عنصر'}`, undo: () => restoreItemsAction(examId, [state]), redo: () => removeItemAction(examId, item.id) })
  }
  if (item.kind === 'PAGE_BREAK') {
    return (
      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <GripVertical className="size-4 cursor-grab" /> <Scissors className="size-4" /> فاصل صفحة
        </span>
        <Button size="sm" variant="ghost" onClick={remove} loading={pending}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    )
  }
  return (
    <div className="p-2">
      <div className="flex items-start gap-2">
        <GripVertical className="mt-1 size-4 shrink-0 cursor-grab text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {item.kind !== 'TEXT' ? <span className="text-sm font-bold">{label}</span> : <Badge variant="muted">نصّ/تعليمات</Badge>}
            {item.kind !== 'TEXT' ? <Badge variant="muted">{pts} ن</Badge> : null}
            {s.difficulty ? <Badge variant={DIFF_AR[s.difficulty]?.variant ?? 'default'}>{DIFF_AR[s.difficulty]?.label}</Badge> : null}
            {s.type && item.kind !== 'TEXT' && s.type !== 'OPEN' ? <Badge variant="outline">{TYPE_AR[s.type] ?? s.type}</Badge> : null}
            {s.sourceLabel ? (
              <span className="text-muted-foreground">
                {s.sourceLabel}
                {s.sourceYear ? ` ${s.sourceYear}` : ''}
              </span>
            ) : null}
            {!item.bankQuestionId && item.kind !== 'TEXT' ? <Badge variant="secondary">حرّ</Badge> : null}
            {s.estimatedMinutes ? <span className="text-muted-foreground">~{s.estimatedMinutes} د</span> : null}
          </div>
          {editing ? (
            <ItemEditor item={item} examId={examId} assets={assets} run={run} pending={pending} onDone={() => setEditing(false)} />
          ) : (
            <div className="studio-paper mt-1 cursor-text text-[13.5px] leading-relaxed text-black" onDoubleClick={() => setEditing(true)} title="نقر مزدوج للتعديل">
              {s.title && s.title !== label ? <p className="font-semibold">{s.title}</p> : null}
              <RichText text={s.body} />
              <FiguresView figures={s.figures} assets={assets} />
              {s.options?.length ? (
                <ol className={cn('mt-1 ps-4', s.optionsColumns && s.optionsColumns > 1 ? `grid gap-x-4 grid-cols-${s.optionsColumns}` : '')}>
                  {s.options.map((o, i) => (
                    <li key={i}>
                      <span className={cn('font-bold', o.isCorrect ? 'text-success' : '')}>{ARABIC_LETTERS[i] ?? i + 1})</span> <RichText text={o.label} inline />
                    </li>
                  ))}
                </ol>
              ) : null}
              {s.children?.length ? (
                <ol className="mt-1 list-decimal space-y-0.5 ps-6">
                  {s.children.map((c, i) => (
                    <li key={i}>
                      <RichText text={c.body} inline /> <span className="text-xs text-muted-foreground">({c.points ?? 0} ن)</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-0.5">
          <Button size="sm" variant="ghost" title="تعديل داخل الورقة" onClick={() => setEditing((v) => !v)}>
            <Settings2 className="size-4" />
          </Button>
          {onCopilot && item.kind !== 'TEXT' ? (
            <Button size="sm" variant="ghost" title="مساعد الذكاء الاصطناعي" onClick={() => onCopilot(item)}>
              <Sparkles className="size-4 text-accent" />
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" title="نسخ" onClick={() => run(() => duplicateItemAction(examId, item.id))} loading={pending}>
            <Copy className="size-4" />
          </Button>
          {item.kind !== 'TEXT' ? (
            <Button size="sm" variant="ghost" title="استبدال ببديل من البنك بنفس المعايير" onClick={() => run(() => replaceItemAction(examId, item.id), 'استُبدل التمرين')} loading={pending}>
              <RefreshCw className="size-4" />
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" title="حذف" onClick={remove} loading={pending}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

type Child = { body: string; points: string; solution: string; type: string; options: { label: string; isCorrect: boolean }[] }
type Draft = { title: string; points: string; body: string; solution: string; type: string; options: { label: string; isCorrect: boolean }[]; optionsColumns: string; children: Child[]; figures: StudioBlock[]; bareme: { label: string; points: string }[]; difficulty: string; estimatedMinutes: string }

function draftOf(item: ExamItemRow): Draft {
  const s = item.snapshot
  return {
    title: item.title ?? '',
    points: String(itemPoints(item)),
    body: s.body,
    solution: s.solution ?? '',
    type: s.type ?? 'OPEN',
    options: (s.options ?? []).map((o) => ({ label: o.label, isCorrect: o.isCorrect })),
    optionsColumns: s.optionsColumns ? String(s.optionsColumns) : '',
    children: (s.children ?? []).map((c) => ({ body: c.body, points: String(c.points ?? 1), solution: c.solution ?? '', type: c.type ?? 'OPEN', options: (c.options ?? []).map((o) => ({ label: o.label, isCorrect: o.isCorrect })) })),
    figures: s.figures ?? [],
    bareme: (s.bareme ?? []).map((b) => ({ label: b.label, points: String(b.points) })),
    difficulty: s.difficulty ? String(s.difficulty) : '2',
    estimatedMinutes: s.estimatedMinutes ? String(s.estimatedMinutes) : ''
  }
}

function patchOf(d: Draft, item: ExamItemRow): ItemPatch {
  const isText = item.kind === 'TEXT'
  const hasChildren = d.children.length > 0
  const patch: ItemPatch = { body: d.body }
  if (isText) return patch
  patch.title = d.title || null
  patch.solution = d.solution || null
  patch.type = d.type
  patch.options = d.type === 'MCQ' ? d.options : []
  patch.optionsColumns = d.type === 'MCQ' && d.optionsColumns ? (Number(d.optionsColumns) as 1 | 2 | 3 | 4) : null
  patch.children = d.children.map((c) => ({ body: c.body, points: Number(c.points) || 0, solution: c.solution || null, type: c.type, options: c.type === 'MCQ' ? c.options : [] }))
  patch.points = hasChildren ? null : Number(d.points) || null
  patch.figures = d.figures
  patch.bareme = d.bareme.map((b) => ({ label: b.label, points: Number(b.points) || 0 }))
  patch.difficulty = Number(d.difficulty) || null
  patch.estimatedMinutes = d.estimatedMinutes ? Number(d.estimatedMinutes) : null
  return patch
}

/** حفظ تلقائي بعد توقّف الكتابة (900ms)، وكل حفظ له تراجع إلى الحالة السابقة كاملة */
function ItemEditor({ item, examId, assets, run, pending, onDone }: { item: ExamItemRow; examId: string; assets: Record<string, string>; run: Run; pending: boolean; onDone: () => void }) {
  const [d, setD] = useState<Draft>(() => draftOf(item))
  const prevState = useRef(stateOf(item))
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSent = useRef(JSON.stringify(d))
  useEffect(() => {
    prevState.current = stateOf(item)
  }, [item])
  const commit = (draft: Draft) => {
    const key = JSON.stringify(draft)
    if (key === lastSent.current) return
    lastSent.current = key
    const before = prevState.current
    const patch = patchOf(draft, item)
    run(() => updateItemAction(examId, item.id, patch), null, {
      label: `تعديل ${item.title ?? 'عنصر'}`,
      undo: () => restoreItemsAction(examId, [before]),
      redo: () => updateItemAction(examId, item.id, patch)
    })
  }
  const set = (p: Partial<Draft>) => {
    const next = { ...d, ...p }
    setD(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => commit(next), 900)
  }
  const done = () => {
    if (timer.current) clearTimeout(timer.current)
    commit(d)
    onDone()
  }
  const isText = item.kind === 'TEXT'
  const hasChildren = d.children.length > 0
  const [figureEditing, setFigureEditing] = useState<number | null>(null)
  const [showMore, setShowMore] = useState(false)
  const addChild = () => set({ children: [...d.children, { body: '', points: '1', solution: '', type: 'OPEN', options: [] }] })
  const setChild = (i: number, p: Partial<Child>) => set({ children: d.children.map((c, k) => (k === i ? { ...c, ...p } : c)) })
  const moveChild = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= d.children.length) return
    const arr = [...d.children]
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
    set({ children: arr })
  }
  const childrenTotal = d.children.reduce((a, c) => a + (Number(c.points) || 0), 0)
  return (
    <div className="mt-2 space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
      {!isText ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_110px_130px]">
          <Input value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="العنوان (التمرين الأول…) — فارغ = تلقائي" dir="auto" />
          {!hasChildren ? <Input type="number" step="0.25" min="0.25" value={d.points} onChange={(e) => set({ points: e.target.value })} dir="ltr" placeholder="النقاط" title="النقاط" /> : <div className="flex items-center text-xs text-muted-foreground">المجموع من الفرعيات: {childrenTotal}</div>}
          <Select value={d.type} onChange={(e) => set({ type: e.target.value, options: e.target.value === 'MCQ' && d.options.length === 0 ? [{ label: '', isCorrect: true }, { label: '', isCorrect: false }, { label: '', isCorrect: false }] : d.options })}>
            <option value="OPEN">سؤال مفتوح</option>
            <option value="MCQ">اختيار متعدد (QCM)</option>
            <option value="TRUE_FALSE">صحيح / خطأ</option>
            <option value="SHORT_ANSWER">إجابة قصيرة</option>
            <option value="FILL_BLANK">ملء فراغات</option>
          </Select>
        </div>
      ) : null}
      <MathInput value={d.body} onChange={(v) => set({ body: v })} rows={isText ? 3 : 5} placeholder={isText ? 'تعليمات للتلميذ…' : 'نصّ التمرين…'} autoFocus previewDefault={false} />

      {!isText && d.type === 'MCQ' ? (
        <div className="space-y-1 rounded-lg border bg-background p-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">الاختيارات (حدّد الصحيح)</p>
            <Select value={d.optionsColumns} onChange={(e) => set({ optionsColumns: e.target.value })} className="h-7 w-auto text-xs">
              <option value="">عمود واحد</option>
              <option value="2">عمودان</option>
              <option value="3">3 أعمدة</option>
              <option value="4">4 أعمدة</option>
            </Select>
          </div>
          {d.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="checkbox" checked={o.isCorrect} onChange={(e) => set({ options: d.options.map((x, k) => (k === i ? { ...x, isCorrect: e.target.checked } : x)) })} className="size-4" title="صحيح" />
              <span className="w-5 text-xs">{ARABIC_LETTERS[i]})</span>
              <Input value={o.label} onChange={(e) => set({ options: d.options.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} dir="auto" className="h-8" placeholder="نصّ الاختيار ($…$ مسموح)" />
              <Button type="button" size="sm" variant="ghost" onClick={() => set({ options: d.options.filter((_, k) => k !== i) })} disabled={d.options.length <= 2}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {d.options.length < 8 ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => set({ options: [...d.options, { label: '', isCorrect: false }] })}>
              <Plus className="size-4" /> اختيار
            </Button>
          ) : null}
        </div>
      ) : null}

      {!isText ? (
        <div className="space-y-1 rounded-lg border bg-background p-2">
          <p className="text-xs font-semibold">الأسئلة الفرعية</p>
          {d.children.map((c, i) => (
            <div key={i} className="grid grid-cols-[auto_1fr_70px_auto] items-start gap-1">
              <span className="pt-2 text-xs text-muted-foreground">{i + 1})</span>
              <div className="space-y-1">
                <Input value={c.body} onChange={(e) => setChild(i, { body: e.target.value })} dir="auto" className="h-8" placeholder="نصّ السؤال الفرعي" />
                {showMore ? <Input value={c.solution} onChange={(e) => setChild(i, { solution: e.target.value })} dir="auto" className="h-8 text-xs" placeholder="حلّه النموذجي (لورقة التصحيح)" /> : null}
              </div>
              <Input type="number" step="0.25" min="0" value={c.points} onChange={(e) => setChild(i, { points: e.target.value })} dir="ltr" className="h-8" title="النقاط" />
              <div className="flex">
                <Button type="button" size="sm" variant="ghost" className="h-8 w-7 px-0" onClick={() => moveChild(i, -1)} disabled={i === 0} title="أعلى">
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8 w-7 px-0" onClick={() => moveChild(i, 1)} disabled={i === d.children.length - 1} title="أسفل">
                  <ArrowDown className="size-3.5" />
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8 w-7 px-0" onClick={() => set({ children: d.children.filter((_, k) => k !== i) })} title="حذف">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={addChild} disabled={d.children.length >= 40}>
              <Plus className="size-4" /> سؤال فرعي
            </Button>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={showMore} onChange={(e) => setShowMore(e.target.checked)} /> حلول الفرعيات
            </label>
          </div>
        </div>
      ) : null}

      {!isText ? (
        <div className="space-y-1 rounded-lg border bg-background p-2">
          <p className="flex items-center gap-1 text-xs font-semibold">
            <Shapes className="size-3.5" /> أشكال داخل التمرين (تظهر بعد النصّ وقبل الأسئلة)
          </p>
          {d.figures.map((f, i) => (
            <div key={i} className="rounded border p-1.5">
              <div className="flex items-center justify-between text-xs">
                <span>
                  {BLOCK_AR[f.type].label}
                  {f.type === 'GRAPH' ? `: ${f.graph.functions.map((x) => x.expr).join(' · ')}` : ''}
                </span>
                <span className="flex gap-1">
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => setFigureEditing(figureEditing === i ? null : i)}>
                    {figureEditing === i ? 'إغلاق' : 'تعديل'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => set({ figures: d.figures.filter((_, k) => k !== i) })}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </span>
              </div>
              {figureEditing === i ? (
                <div className="mt-1">
                  <BlockEditor block={f} onChange={(b) => set({ figures: d.figures.map((x, k) => (k === i ? b : x)) })} assets={assets} />
                </div>
              ) : null}
            </div>
          ))}
          {d.figures.length < 6 ? (
            <div className="flex flex-wrap gap-1">
              {FIGURE_TYPES.map((t) => (
                <Button
                  key={t}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    set({ figures: [...d.figures, defaultBlock(t)] })
                    setFigureEditing(d.figures.length)
                  }}
                >
                  <Plus className="size-3" /> {BLOCK_AR[t].label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {!isText ? (
        <details className="rounded-lg border bg-background p-2">
          <summary className="cursor-pointer text-xs font-semibold">الحلّ النموذجي، سلّم التنقيط، الصعوبة والزمن</summary>
          <div className="mt-2 space-y-2">
            <MathInput value={d.solution} onChange={(v) => set({ solution: v })} rows={3} placeholder="الحلّ النموذجي (لورقة التصحيح)" previewDefault={false} />
            <div className="space-y-1">
              <p className="text-xs font-semibold">سلّم التنقيط التفصيلي</p>
              {d.bareme.map((b, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_auto] gap-1">
                  <Input value={b.label} onChange={(e) => set({ bareme: d.bareme.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} dir="auto" className="h-8" placeholder="البند (مثلاً: حساب النهاية)" />
                  <Input type="number" step="0.25" min="0" value={b.points} onChange={(e) => set({ bareme: d.bareme.map((x, k) => (k === i ? { ...x, points: e.target.value } : x)) })} dir="ltr" className="h-8" />
                  <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => set({ bareme: d.bareme.filter((_, k) => k !== i) })}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="ghost" onClick={() => set({ bareme: [...d.bareme, { label: '', points: '1' }] })} disabled={d.bareme.length >= 40}>
                <Plus className="size-4" /> بند
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="الصعوبة" htmlFor={`diff-${item.id}`}>
                <Select id={`diff-${item.id}`} value={d.difficulty} onChange={(e) => set({ difficulty: e.target.value })}>
                  <option value="1">سهل</option>
                  <option value="2">متوسط</option>
                  <option value="3">صعب</option>
                  <option value="4">صعب جداً</option>
                </Select>
              </Field>
              <Field label="الزمن التقديري (د)" htmlFor={`min-${item.id}`}>
                <Input id={`min-${item.id}`} type="number" min="0" value={d.estimatedMinutes} onChange={(e) => set({ estimatedMinutes: e.target.value })} dir="ltr" />
              </Field>
            </div>
          </div>
        </details>
      ) : null}

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={done} loading={pending}>
          <Check className="size-4" /> تمّ
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          <X className="size-4" /> إغلاق
        </Button>
        <span className="text-xs text-muted-foreground">يُحفظ تلقائياً أثناء الكتابة؛ البنك لا يتغيّر.</span>
      </div>
    </div>
  )
}

export type { ExamItemSnapshot }
