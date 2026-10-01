'use client'

import { Copy, FileCheck2, FileText, GripVertical, Plus, Printer, Scissors, Search, Settings2, Trash2, Wand2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type DragEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert, EmptyState } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { DIFF_AR, KIND_AR, TYPE_AR } from '@/lib/bank-labels'
import { cn } from '@/lib/utils'
import { addFreeItemAction, addFromBankAction, duplicateItemAction, rebalanceAction, removeItemAction, reorderItemsAction, searchBankAction, updateExamAction, updateItemAction } from '@/server/actions/exams.actions'
import type { ExamItemRow } from '@/server/db/schema'
import type { ExamKind } from '@/server/db/schema/enums'
import { EXAM_KIND_AR, itemPoints, type ExamView } from '@/server/services/exams.service'
import type { BankListItem } from '@/server/services/question-bank.service'

type Opt = { id: string; name: string }
type Result = { ok: boolean; error?: { message: string } } & Record<string, unknown>

/**
 * محرّر الامتحان الثلاثي: البنك (يمين) ← الورقة (وسط) ← الإعدادات (يسار).
 * سحب وإفلات أصلي (HTML5) بلا مكتبات؛ وكل زرّ له بديل بالضغط للهاتف.
 */
export function ExamBuilder({ exam, options }: { exam: ExamView; options: { subjects: Opt[]; levels: Opt[]; streams: Opt[]; groups?: Opt[] } }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = useCallback(
    (fn: () => Promise<Result>, ok?: string) =>
      start(async () => {
        const r = await fn()
        if (!r.ok) toast('error', r.error!.message)
        else {
          if (ok) toast('success', ok)
          router.refresh()
        }
      }),
    [router]
  )

  // ── الورقة: ترتيب محلي متفائل أثناء السحب
  const [order, setOrder] = useState(exam.items.map((i) => i.id))
  useEffect(() => setOrder(exam.items.map((i) => i.id)), [exam.items])
  const byId = useMemo(() => new Map(exam.items.map((i) => [i.id, i])), [exam.items])
  const dragId = useRef<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [dropEnd, setDropEnd] = useState(false)

  const onDragStart = (e: DragEvent, id: string) => {
    dragId.current = id
    e.dataTransfer.setData('text/x-exam-item', id)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDropOnItem = (e: DragEvent, targetId: string) => {
    e.preventDefault()
    setOverId(null)
    const bank = e.dataTransfer.getData('text/x-bank-question')
    const targetPos = order.indexOf(targetId)
    if (bank) return run(() => addFromBankAction(exam.id, bank, targetPos), 'أُضيف')
    const from = dragId.current
    dragId.current = null
    if (!from || from === targetId) return
    const next = order.filter((x) => x !== from)
    next.splice(next.indexOf(targetId), 0, from)
    setOrder(next)
    run(() => reorderItemsAction(exam.id, next))
  }
  const onDropEnd = (e: DragEvent) => {
    e.preventDefault()
    setDropEnd(false)
    const bank = e.dataTransfer.getData('text/x-bank-question')
    if (bank) return run(() => addFromBankAction(exam.id, bank, null), 'أُضيف')
    const from = dragId.current
    dragId.current = null
    if (!from) return
    const next = [...order.filter((x) => x !== from), from]
    setOrder(next)
    run(() => reorderItemsAction(exam.id, next))
  }
  const allow = (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const total = Number(exam.totalPoints)
  const target = Number(exam.targetPoints)
  const off = Math.round((total - target) * 100) / 100
  const d = exam.difficultySummary
  const counts = d.counts ?? {}
  const graded = Object.values(counts).reduce((a, b) => a + b, 0)
  const pct = (k: string) => (graded ? Math.round(((counts[k] ?? 0) / graded) * 100) : 0)

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_300px]">
      {/* ── البنك (يمين) */}
      <aside className="order-1 space-y-3 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:overflow-auto">
        <BankPanel exam={exam} onAdd={(qid) => run(() => addFromBankAction(exam.id, qid, null), 'أُضيف إلى الورقة')} pending={pending} />
      </aside>

      {/* ── الورقة (وسط) */}
      <main className="order-3 xl:order-2">
        <div className="rounded-xl border bg-card shadow-sm">
          <header className="space-y-1 border-b p-5 text-center text-sm">
            <p className="font-bold">الجمهورية الجزائرية الديمقراطية الشعبية</p>
            <p className="text-xs text-muted-foreground">وزارة التربية الوطنية</p>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-start text-xs sm:grid-cols-3">
              <span>المؤسسة: {exam.header.school || '…………'}</span>
              <span>المادة: {exam.subjectName ?? '…………'}</span>
              <span>المستوى: {[exam.levelName, exam.streamName].filter(Boolean).join(' — ') || '…………'}</span>
              <span>المدة: {exam.durationMinutes >= 60 ? `${Math.floor(exam.durationMinutes / 60)} سا${exam.durationMinutes % 60 ? ` و${exam.durationMinutes % 60} د` : ''}` : `${exam.durationMinutes} د`}</span>
              <span>الأستاذ: {exam.header.teacherName || '…………'}</span>
              <span>السنة الدراسية: {exam.academicYear ?? '…………'}</span>
            </div>
            <h2 className="pt-3 font-display text-xl font-bold">{exam.heading}</h2>
            <p className="font-semibold">{exam.title}</p>
            {exam.instructions ? <p className="text-xs text-muted-foreground">{exam.instructions}</p> : null}
          </header>

          <ol className="space-y-3 p-4">
            {order.length === 0 ? <EmptyState icon={FileText} title="الورقة فارغة" description="اسحب سؤالاً من البنك إلى هنا، أو اضغط «إضافة» عليه، أو أضف تمريناً حرّاً." /> : null}
            {order.map((id) => {
              const it = byId.get(id)
              if (!it) return null
              return (
                <li key={id} draggable onDragStart={(e) => onDragStart(e, id)} onDragOver={(e) => { allow(e); setOverId(id) }} onDragLeave={() => setOverId(null)} onDrop={(e) => onDropOnItem(e, id)} className={cn('rounded-lg border bg-background transition-colors', overId === id ? 'border-primary ring-2 ring-primary/20' : '')}>
                  <ItemCard item={it} label={exam.numbering[id]} examId={exam.id} run={run} pending={pending} />
                </li>
              )
            })}
            <li onDragOver={(e) => { allow(e); setDropEnd(true) }} onDragLeave={() => setDropEnd(false)} onDrop={onDropEnd} className={cn('rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground', dropEnd ? 'border-primary bg-primary/5' : '')}>
              أفلت هنا للإضافة في آخر الورقة
            </li>
          </ol>
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-sm">
            <AddFree examId={exam.id} run={run} pending={pending} />
            <span className={cn('font-bold tabular', off === 0 ? 'text-success' : 'text-warning')}>
              المجموع: {total} / {target}
            </span>
          </footer>
        </div>
      </main>

      {/* ── الإعدادات (يسار) */}
      <aside className="order-2 space-y-3 xl:order-3 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:overflow-auto">
        <div className="space-y-2 rounded-xl border bg-card p-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <Button asChild>
              <a href={`/print/exams/${exam.id}?mode=subject`} target="_blank" rel="noreferrer">
                <Printer className="size-4" /> PDF الموضوع
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={`/print/exams/${exam.id}?mode=correction`} target="_blank" rel="noreferrer">
                <FileCheck2 className="size-4" /> PDF التصحيح
              </a>
            </Button>
          </div>
          <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            نسخ ضدّ الغشّ (ترتيب مختلف، نفس الصعوبة):
            {['A', 'B', 'C', 'D'].map((v) => (
              <a key={v} href={`/print/exams/${exam.id}?mode=subject&variant=${v}`} target="_blank" rel="noreferrer" className="rounded border px-2 py-0.5 text-primary hover:border-primary">
                {v}
              </a>
            ))}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-sm">
          <p className="mb-2 flex items-center gap-2 font-bold">
            <Settings2 className="size-4" /> النقاط والصعوبة
          </p>
          <p className="text-2xl font-bold tabular">
            {total} <span className="text-base text-muted-foreground">/ {target}</span>
          </p>
          {off !== 0 && graded > 0 ? (
            <Alert tone="warning" className="mt-2">
              المجموع {off > 0 ? 'يزيد' : 'ينقص'} بـ{Math.abs(off)} نقطة.
              <Button size="sm" variant="outline" className="mt-2" onClick={() => run(() => rebalanceAction(exam.id), 'أُعيد التوزيع')} loading={pending}>
                <Wand2 className="size-4" /> إعادة توزيع النقاط على {target}
              </Button>
            </Alert>
          ) : null}
          {graded > 0 ? (
            <div className="mt-3 space-y-1 text-xs">
              <p>
                مستوى الامتحان: <strong>{d.label ?? '—'}</strong>
                {d.minutes ? ` · زمن تقديري ${d.minutes} د من ${exam.durationMinutes}` : ''}
              </p>
              {[
                ['1', 'سهل', 'bg-success'],
                ['2', 'متوسط', 'bg-primary'],
                ['3', 'صعب', 'bg-warning'],
                ['4', 'صعب جداً', 'bg-destructive']
              ].map(([k, label, color]) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-16">{label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full', color)} style={{ width: `${pct(k!)}%` }} />
                  </div>
                  <span className="w-10 text-end tabular">{pct(k!)}%</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <ExamSettings exam={exam} options={options} run={run} pending={pending} />
      </aside>
    </div>
  )
}

/* ─────────────────────────── عنصر الورقة ─────────────────────────── */

function ItemCard({ item, label, examId, run, pending }: { item: ExamItemRow; label?: string; examId: string; run: (fn: () => Promise<Result>, ok?: string) => void; pending: boolean }) {
  const [editing, setEditing] = useState(false)
  const s = item.snapshot
  const pts = itemPoints(item)
  if (item.kind === 'PAGE_BREAK') {
    return (
      <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <GripVertical className="size-4 cursor-grab" /> <Scissors className="size-4" /> فاصل صفحة
        </span>
        <Button size="sm" variant="ghost" onClick={() => run(() => removeItemAction(examId, item.id))} loading={pending}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    )
  }
  return (
    <div className="p-3">
      <div className="flex items-start gap-2">
        <GripVertical className="mt-1 size-4 shrink-0 cursor-grab text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {item.kind !== 'TEXT' ? <span className="font-bold">{label}</span> : <Badge variant="muted">نصّ</Badge>}
            {item.kind !== 'TEXT' ? <Badge variant="muted">{pts} ن</Badge> : null}
            {s.difficulty ? <Badge variant={DIFF_AR[s.difficulty]?.variant ?? 'default'}>{DIFF_AR[s.difficulty]?.label}</Badge> : null}
            {s.type && item.kind !== 'TEXT' ? <Badge variant="outline">{TYPE_AR[s.type] ?? s.type}</Badge> : null}
            {s.sourceLabel ? <span className="text-xs text-muted-foreground">{s.sourceLabel}{s.sourceYear ? ` ${s.sourceYear}` : ''}</span> : null}
            {!item.bankQuestionId && item.kind !== 'TEXT' ? <Badge variant="secondary">حرّ</Badge> : null}
          </div>
          {editing ? (
            <ItemEditor item={item} examId={examId} run={run} pending={pending} onDone={() => setEditing(false)} />
          ) : (
            <>
              {s.title && s.title !== label ? <p className="mt-1 font-semibold">{s.title}</p> : null}
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed" dir="auto">
                {s.body}
              </p>
              {s.options?.length ? (
                <ol className="mt-1 list-[arabic-indic] ps-6 text-sm">
                  {s.options.map((o, i) => (
                    <li key={i}>{o.label}</li>
                  ))}
                </ol>
              ) : null}
              {s.children?.length ? (
                <ol className="mt-2 list-decimal space-y-1 ps-6 text-sm">
                  {s.children.map((c, i) => (
                    <li key={i}>
                      <span className="whitespace-pre-line" dir="auto">
                        {c.body}
                      </span>{' '}
                      <span className="text-xs text-muted-foreground">({c.points ?? 0} ن)</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <Button size="sm" variant="ghost" title="تعديل داخل الورقة" onClick={() => setEditing((v) => !v)}>
            <Settings2 className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" title="نسخ" onClick={() => run(() => duplicateItemAction(examId, item.id))} loading={pending}>
            <Copy className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" title="حذف" onClick={() => run(() => removeItemAction(examId, item.id))} loading={pending}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function ItemEditor({ item, examId, run, pending, onDone }: { item: ExamItemRow; examId: string; run: (fn: () => Promise<Result>, ok?: string) => void; pending: boolean; onDone: () => void }) {
  const s = item.snapshot
  const [title, setTitle] = useState(item.title ?? '')
  const [body, setBody] = useState(s.body)
  const [solution, setSolution] = useState(s.solution ?? '')
  const [points, setPoints] = useState(String(itemPoints(item)))
  const [childPoints, setChildPoints] = useState((s.children ?? []).map((c) => String(c.points ?? 1)))
  const hasChildren = (s.children?.length ?? 0) > 0
  const save = () =>
    run(
      () =>
        updateItemAction(examId, item.id, {
          title: title || null,
          body,
          solution: solution || null,
          ...(hasChildren ? { childPoints: childPoints.map((p) => Number(p) || 0), points: null } : item.kind === 'TEXT' ? {} : { points: Number(points) || null })
        }),
      'حُفظ'
    )
  return (
    <div className="mt-2 space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
      {item.kind !== 'TEXT' ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="العنوان (التمرين الأول…) — فارغ = تلقائي" />
          {!hasChildren ? <Input type="number" step="0.5" min="0.5" value={points} onChange={(e) => setPoints(e.target.value)} dir="ltr" placeholder="النقاط" /> : null}
        </div>
      ) : null}
      <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} dir="auto" />
      {hasChildren ? (
        <div className="space-y-1">
          {s.children!.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_90px] items-center gap-2 text-xs">
              <span className="truncate">{c.body}</span>
              <Input type="number" step="0.25" min="0" value={childPoints[i] ?? ''} onChange={(e) => setChildPoints((arr) => arr.map((v, j) => (j === i ? e.target.value : v)))} dir="ltr" />
            </div>
          ))}
        </div>
      ) : null}
      {item.kind !== 'TEXT' ? <Textarea rows={3} value={solution} onChange={(e) => setSolution(e.target.value)} dir="auto" placeholder="الحلّ النموذجي (لورقة التصحيح)" /> : null}
      <div className="flex gap-2">
        <Button size="sm" onClick={save} loading={pending}>
          حفظ
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          إلغاء
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">التعديل هنا يخصّ هذه الورقة فقط؛ السؤال في البنك لا يتغيّر.</p>
    </div>
  )
}

function AddFree({ examId, run, pending }: { examId: string; run: (fn: () => Promise<Result>, ok?: string) => void; pending: boolean }) {
  const [open, setOpen] = useState<'EXERCISE' | 'TEXT' | null>(null)
  const [body, setBody] = useState('')
  const [points, setPoints] = useState('4')
  const submit = () => {
    const kind = open!
    run(() => addFreeItemAction(examId, { kind, body, points: kind === 'EXERCISE' ? Number(points) || 1 : null }), 'أُضيف')
    setOpen(null)
    setBody('')
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => setOpen(open === 'EXERCISE' ? null : 'EXERCISE')}>
        <Plus className="size-4" /> تمرين حرّ
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(open === 'TEXT' ? null : 'TEXT')}>
        نصّ/تعليمات
      </Button>
      <Button size="sm" variant="ghost" onClick={() => run(() => addFreeItemAction(examId, { kind: 'PAGE_BREAK' }))} loading={pending}>
        <Scissors className="size-4" /> فاصل صفحة
      </Button>
      {open ? (
        <div className="w-full space-y-2 rounded-lg border p-3">
          <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} dir="auto" placeholder={open === 'EXERCISE' ? 'نصّ التمرين…' : 'تعليمات للتلميذ…'} />
          <div className="flex items-center gap-2">
            {open === 'EXERCISE' ? <Input type="number" step="0.5" min="0.5" value={points} onChange={(e) => setPoints(e.target.value)} dir="ltr" className="w-24" /> : null}
            <Button size="sm" onClick={submit} loading={pending} disabled={!body.trim()}>
              إضافة
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ─────────────────────────── لوحة البنك ─────────────────────────── */

function BankPanel({ exam, onAdd, pending }: { exam: ExamView; onAdd: (id: string) => void; pending: boolean }) {
  const [q, setQ] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [scope, setScope] = useState<'all' | 'mine' | 'central' | 'favorites'>('all')
  const [sameSubject, setSameSubject] = useState(true)
  const [items, setItems] = useState<BankListItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inExam = useMemo(() => new Set(exam.items.map((i) => i.bankQuestionId).filter(Boolean)), [exam.items])

  const load = useCallback(
    async (append = false, c: string | null = null) => {
      setLoading(true)
      const r = await searchBankAction({ scope, q, subjectId: sameSubject ? exam.subjectId : null, levelId: sameSubject ? exam.levelId : null, difficulties: difficulty ? [Number(difficulty)] : undefined }, c)
      setLoading(false)
      if (!r.ok) return toast('error', r.error.message)
      setItems((prev) => (append ? [...prev, ...r.data.items] : r.data.items))
      setCursor(r.data.nextCursor)
    },
    [scope, q, sameSubject, difficulty, exam.subjectId, exam.levelId]
  )
  useEffect(() => {
    const t = setTimeout(() => void load(false, null), 250)
    return () => clearTimeout(t)
  }, [load])

  return (
    <div className="rounded-xl border bg-card p-3 text-sm">
      <p className="mb-2 flex items-center justify-between font-bold">
        <span>بنك الأسئلة</span>
        <Link href="/teacher/bank" className="text-xs font-normal text-primary underline">
          فتح البنك
        </Link>
      </p>
      <div className="relative">
        <Search className="absolute end-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث…" className="pe-8" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
          <option value="all">الكل</option>
          <option value="mine">بنكي</option>
          <option value="central">Madrasadz</option>
          <option value="favorites">المفضّلة</option>
        </Select>
        <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="">كل الصعوبات</option>
          <option value="1">سهل</option>
          <option value="2">متوسط</option>
          <option value="3">صعب</option>
          <option value="4">صعب جداً</option>
        </Select>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs">
        <input type="checkbox" className="size-4" checked={sameSubject} onChange={(e) => setSameSubject(e.target.checked)} /> مادة الامتحان وصفّه فقط
      </label>
      <ul className="mt-3 space-y-2">
        {items.map((b) => (
          <li key={b.id} draggable onDragStart={(e) => { e.dataTransfer.setData('text/x-bank-question', b.id); e.dataTransfer.effectAllowed = 'copy' }} className={cn('cursor-grab rounded-lg border p-2 hover:border-primary/50', inExam.has(b.id) ? 'opacity-60' : '')}>
            <div className="flex flex-wrap items-center gap-1 text-[11px]">
              <Badge variant="secondary">{KIND_AR[b.kind]}</Badge>
              <Badge variant={DIFF_AR[b.difficulty]?.variant ?? 'default'}>{DIFF_AR[b.difficulty]?.label}</Badge>
              <Badge variant="muted">{Number(b.points)} ن</Badge>
              {b.children ? <Badge variant="muted">{b.children} فرعي</Badge> : null}
              {inExam.has(b.id) ? <Badge variant="success">في الورقة</Badge> : null}
            </div>
            <p className="mt-1 line-clamp-3 text-xs" dir="auto">
              {b.title ? <strong>{b.title} — </strong> : null}
              {b.body}
            </p>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="truncate">{b.sourceLabel ?? b.nodeTitle ?? b.subjectName ?? ''}</span>
              <Button size="sm" variant="outline" onClick={() => onAdd(b.id)} loading={pending}>
                <Plus className="size-3" /> إضافة
              </Button>
            </div>
          </li>
        ))}
        {!loading && items.length === 0 ? <li className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">لا نتائج. وسّع البحث أو ألغِ قيد المادة.</li> : null}
      </ul>
      {cursor ? (
        <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={() => void load(true, cursor)} loading={loading}>
          المزيد
        </Button>
      ) : null}
    </div>
  )
}

/* ─────────────────────────── الإعدادات ─────────────────────────── */

function ExamSettings({ exam, options, run, pending }: { exam: ExamView; options: { subjects: Opt[]; levels: Opt[]; streams: Opt[]; groups?: Opt[] }; run: (fn: () => Promise<Result>, ok?: string) => void; pending: boolean }) {
  const [f, setF] = useState({
    title: exam.title,
    kind: exam.kind as ExamKind,
    subjectId: exam.subjectId ?? '',
    levelId: exam.levelId ?? '',
    streamId: exam.streamId ?? '',
    schoolTerm: exam.schoolTerm ? String(exam.schoolTerm) : '',
    durationMinutes: String(exam.durationMinutes),
    targetPoints: String(Number(exam.targetPoints)),
    academicYear: exam.academicYear ?? '',
    instructions: exam.instructions ?? '',
    status: exam.status === 'READY' ? 'READY' : 'DRAFT',
    groupId: exam.groupId ?? '',
    isTemplate: exam.isTemplate ? '1' : '',
    school: exam.header.school ?? '',
    wilaya: exam.header.wilaya ?? '',
    teacherName: exam.header.teacherName ?? '',
    heading: exam.header.heading ?? ''
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }))
  const save = () =>
    run(
      () =>
        updateExamAction(exam.id, {
          title: f.title,
          kind: f.kind,
          subjectId: f.subjectId || null,
          levelId: f.levelId || null,
          streamId: f.streamId || null,
          schoolTerm: f.schoolTerm ? Number(f.schoolTerm) : null,
          durationMinutes: Number(f.durationMinutes) || 120,
          targetPoints: Number(f.targetPoints) || 20,
          academicYear: f.academicYear || null,
          instructions: f.instructions || null,
          header: { school: f.school, wilaya: f.wilaya, teacherName: f.teacherName, heading: f.heading },
          status: exam.status === 'ARCHIVED' ? undefined : (f.status as 'DRAFT' | 'READY'),
          groupId: f.groupId || null,
          isTemplate: f.isTemplate === '1'
        }),
      'حُفظت الإعدادات'
    )
  return (
    <div className="space-y-2 rounded-xl border bg-card p-4 text-sm">
      <p className="font-bold">إعدادات الامتحان</p>
      <Field label="العنوان" htmlFor="ex-title">
        <Input id="ex-title" value={f.title} onChange={set('title')} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="النوع" htmlFor="ex-kind">
          <Select id="ex-kind" value={f.kind} onChange={set('kind')}>
            {Object.entries(EXAM_KIND_AR).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الفصل" htmlFor="ex-term">
          <Select id="ex-term" value={f.schoolTerm} onChange={set('schoolTerm')}>
            <option value="">—</option>
            <option value="1">الأول</option>
            <option value="2">الثاني</option>
            <option value="3">الثالث</option>
          </Select>
        </Field>
        <Field label="المادة" htmlFor="ex-subject">
          <Select id="ex-subject" value={f.subjectId} onChange={set('subjectId')}>
            <option value="">—</option>
            {options.subjects.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الصف" htmlFor="ex-level">
          <Select id="ex-level" value={f.levelId} onChange={set('levelId')}>
            <option value="">—</option>
            {options.levels.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الشعبة" htmlFor="ex-stream">
          <Select id="ex-stream" value={f.streamId} onChange={set('streamId')}>
            <option value="">—</option>
            {options.streams.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="المدة (دقائق)" htmlFor="ex-duration">
          <Input id="ex-duration" type="number" min="5" max="600" value={f.durationMinutes} onChange={set('durationMinutes')} dir="ltr" />
        </Field>
        <Field label="المجموع المستهدف" htmlFor="ex-target">
          <Input id="ex-target" type="number" min="1" max="200" step="0.5" value={f.targetPoints} onChange={set('targetPoints')} dir="ltr" />
        </Field>
        <Field label="السنة الدراسية" htmlFor="ex-year">
          <Input id="ex-year" value={f.academicYear} onChange={set('academicYear')} dir="ltr" placeholder="2026/2027" />
        </Field>
      </div>
      <Field label="عنوان الترويسة" htmlFor="ex-heading" hint="فارغ = يُشتقّ من النوع والفصل">
        <Input id="ex-heading" value={f.heading} onChange={set('heading')} placeholder="اختبار الفصل الأول" />
      </Field>
      <Field label="المؤسسة" htmlFor="ex-school">
        <Input id="ex-school" value={f.school} onChange={set('school')} placeholder="ثانوية …" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="الولاية" htmlFor="ex-wilaya">
          <Input id="ex-wilaya" value={f.wilaya} onChange={set('wilaya')} />
        </Field>
        <Field label="الأستاذ" htmlFor="ex-teacher">
          <Input id="ex-teacher" value={f.teacherName} onChange={set('teacherName')} />
        </Field>
      </div>
      <Field label="تعليمات للتلميذ" htmlFor="ex-instr">
        <Textarea id="ex-instr" rows={2} value={f.instructions} onChange={set('instructions')} dir="auto" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="الحالة" htmlFor="ex-status" hint="«جاهز» = اكتملت المراجعة">
          <Select id="ex-status" value={f.status} onChange={set('status')} disabled={exam.status === 'ARCHIVED'}>
            <option value="DRAFT">مسودة</option>
            <option value="READY">جاهز</option>
          </Select>
        </Field>
        <Field label="الفوج" htmlFor="ex-group" hint="لمن أُعدّ هذا الامتحان">
          <Select id="ex-group" value={f.groupId} onChange={set('groupId')}>
            <option value="">—</option>
            {(options.groups ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <label className="flex items-start gap-2 rounded-lg border p-2">
        <input type="checkbox" className="mt-0.5 size-4" checked={f.isTemplate === '1'} onChange={(e) => setF((s) => ({ ...s, isTemplate: e.target.checked ? '1' : '' }))} />
        <span>
          <span className="font-semibold">قالب</span>
          <span className="block text-xs text-muted-foreground">يظهر في «قوالبي» ويُنشأ منه امتحان جديد بترويسته وإعداداته وعناصره.</span>
        </span>
      </label>
      <Button size="sm" onClick={save} loading={pending} className="w-full">
        حفظ الإعدادات
      </Button>
    </div>
  )
}
