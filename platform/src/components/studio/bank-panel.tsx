'use client'

import { Plus, Search, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { DIFF_AR, KIND_AR } from '@/lib/bank-labels'
import { cn } from '@/lib/utils'
import { listNodesAction, searchBankAction, type NodeOption } from '@/server/actions/exams.actions'
import type { ExamView } from '@/server/services/exams.service'
import type { BankListItem } from '@/server/services/question-bank.service'
import { DND } from './paper'

/**
 * لوحة البنك داخل الاستوديو: بحث ومرشّحات (النطاق، الصعوبة، الدرس، النوع، بحلّ)، سحب إلى الورقة أو إضافة بضغطة.
 * الوضع المركّز يقيّد النتائج بمادة الامتحان وصفّه.
 */
export function BankPanel({ exam, focused, onAdd, pending }: { exam: ExamView; focused: boolean; onAdd: (qid: string) => void; pending: boolean }) {
  const [q, setQ] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [scope, setScope] = useState<'all' | 'mine' | 'central' | 'favorites'>('all')
  const [sameSubject, setSameSubject] = useState(true)
  const [nodeId, setNodeId] = useState('')
  const [kind, setKind] = useState('')
  const [hasSolution, setHasSolution] = useState(false)
  const [filters, setFilters] = useState(false)
  const [nodes, setNodes] = useState<NodeOption[]>([])
  const [items, setItems] = useState<BankListItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inExam = useMemo(() => new Set(exam.items.map((i) => i.bankQuestionId).filter(Boolean)), [exam.items])
  const restrict = focused || sameSubject

  useEffect(() => {
    if (!exam.subjectId || !exam.levelId) return setNodes([])
    let alive = true
    listNodesAction({ subjectId: exam.subjectId, levelId: exam.levelId, streamId: exam.streamId }).then((r) => {
      if (alive && r.ok) setNodes(r.data.nodes)
    })
    return () => {
      alive = false
    }
  }, [exam.subjectId, exam.levelId, exam.streamId])

  const load = useCallback(
    async (append = false, c: string | null = null) => {
      setLoading(true)
      const r = await searchBankAction({ scope, q, subjectId: restrict ? exam.subjectId : null, levelId: restrict ? exam.levelId : null, curriculumNodeId: nodeId || null, difficulties: difficulty ? [Number(difficulty)] : undefined, kinds: kind ? [kind as 'EXERCISE'] : undefined, hasSolution: hasSolution ? true : null }, c)
      setLoading(false)
      if (!r.ok) return toast('error', r.error.message)
      setItems((prev) => (append ? [...prev, ...r.data.items] : r.data.items))
      setCursor(r.data.nextCursor)
    },
    [scope, q, restrict, difficulty, nodeId, kind, hasSolution, exam.subjectId, exam.levelId]
  )
  useEffect(() => {
    const t = setTimeout(() => void load(false, null), 250)
    return () => clearTimeout(t)
  }, [load])

  return (
    <div className="space-y-2 text-sm">
      <p className="flex items-center justify-between font-bold">
        <span>بنك الأسئلة</span>
        <Link href="/teacher/bank" className="text-xs font-normal text-primary underline">
          فتح البنك
        </Link>
      </p>
      <div className="relative">
        <Search className="absolute end-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث: متتالية، احتمال، الشابي…" className="h-9 pe-8" />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="h-8">
          <option value="all">الكل</option>
          <option value="mine">بنكي</option>
          <option value="central">بنك Madrasadz</option>
          <option value="favorites">المفضّلة</option>
        </Select>
        <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="h-8">
          <option value="">كل الصعوبات</option>
          <option value="1">سهل</option>
          <option value="2">متوسط</option>
          <option value="3">صعب</option>
          <option value="4">صعب جداً</option>
        </Select>
      </div>
      <button type="button" className="flex items-center gap-1 text-xs text-primary" onClick={() => setFilters((v) => !v)}>
        <SlidersHorizontal className="size-3.5" /> {filters ? 'إخفاء المرشّحات' : 'مرشّحات أكثر'}
      </button>
      {filters ? (
        <div className="space-y-1.5 rounded-lg border p-2 text-xs">
          <Select value={nodeId} onChange={(e) => setNodeId(e.target.value)} className="h-8" disabled={!nodes.length}>
            <option value="">كل الدروس{nodes.length ? '' : ' (حدّد المادة والصف أولاً)'}</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </Select>
          <Select value={kind} onChange={(e) => setKind(e.target.value)} className="h-8">
            <option value="">كل الأنواع</option>
            {Object.entries(KIND_AR).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4" checked={hasSolution} onChange={(e) => setHasSolution(e.target.checked)} /> بحلّ نموذجي فقط
          </label>
          <label className={cn('flex items-center gap-2', focused ? 'opacity-60' : '')}>
            <input type="checkbox" className="size-4" checked={restrict} disabled={focused} onChange={(e) => setSameSubject(e.target.checked)} /> مادة الامتحان وصفّه فقط{focused ? ' (الوضع المركّز)' : ''}
          </label>
        </div>
      ) : null}
      <ul className="space-y-1.5">
        {items.map((b) => (
          <li key={b.id} draggable onDragStart={(e) => { e.dataTransfer.setData(DND.bank, b.id); e.dataTransfer.effectAllowed = 'copy' }} className={cn('cursor-grab rounded-lg border bg-background p-2 hover:border-primary/50', inExam.has(b.id) ? 'opacity-60' : '')}>
            <div className="flex flex-wrap items-center gap-1 text-[11px]">
              <Badge variant="secondary">{KIND_AR[b.kind]}</Badge>
              <Badge variant={DIFF_AR[b.difficulty]?.variant ?? 'default'}>{DIFF_AR[b.difficulty]?.label}</Badge>
              <Badge variant="muted">{Number(b.points)} ن</Badge>
              {b.children ? <Badge variant="muted">{b.children} فرعي</Badge> : null}
              {b.solution ? <Badge variant="success">بحلّ</Badge> : null}
              {inExam.has(b.id) ? <Badge variant="success">في الورقة</Badge> : null}
            </div>
            <p className="mt-1 line-clamp-3 text-xs" dir="auto">
              {b.title ? <strong>{b.title} — </strong> : null}
              {b.body}
            </p>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="truncate">{b.sourceLabel ?? b.nodeTitle ?? b.subjectName ?? ''}</span>
              <Button size="sm" variant="outline" className="h-6 px-2" onClick={() => onAdd(b.id)} loading={pending}>
                <Plus className="size-3" /> إضافة
              </Button>
            </div>
          </li>
        ))}
        {!loading && items.length === 0 ? <li className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">لا نتائج. وسّع البحث أو ألغِ قيد المادة.</li> : null}
      </ul>
      {cursor ? (
        <Button size="sm" variant="ghost" className="w-full" onClick={() => void load(true, cursor)} loading={loading}>
          المزيد
        </Button>
      ) : null}
    </div>
  )
}
