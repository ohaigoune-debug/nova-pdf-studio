'use client'

import { CheckCircle2, Eye, Filter, PauseCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import { bulkPlayReviewAction, bulkPlayReviewByFilterAction } from '@/server/actions/play-admin.actions'
import type { PlayReviewStatus } from '@/server/play/constants'
import { hasAnyFilter, type PlayFilterParams } from './filter-params'
import { difficultyAr, STATUS_AR, STATUS_VARIANT, statusAr, typeAr } from './labels'

export interface QuestionRow {
  id: string
  key: string
  type: string
  gradeCode: string
  gradeName: string
  streamCodes: string[]
  subjectName: string
  lessonName: string
  difficulty: string
  questionText: string
  reviewStatus: string
  isSuspended: boolean
  reportsCount: number
  qualityFlags: string[]
  timesCorrect: number
  timesWrong: number
}

const BULK: { status: PlayReviewStatus; label: string; variant: 'success' | 'destructive' | 'outline' }[] = [
  { status: 'APPROVED', label: 'اعتماد', variant: 'success' },
  { status: 'REJECTED', label: 'رفض', variant: 'destructive' },
  { status: 'NEEDS_REVIEW', label: 'يحتاج مراجعة', variant: 'outline' }
]

export function QuestionsTable({ rows, filter, total }: { rows: QuestionRow[]; filter: PlayFilterParams; total: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmFilter, setConfirmFilter] = useState<PlayReviewStatus | null>(null)
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id))

  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const runBulk = (status: PlayReviewStatus) =>
    start(async () => {
      const r = await bulkPlayReviewAction({ ids: [...selected], status })
      if (!r.ok) return toast('error', r.error.message)
      toast('success', `حُدّثت حالة ${r.data.count} سؤالاً إلى «${STATUS_AR[status]}»`)
      setSelected(new Set())
      router.refresh()
    })

  const runFilter = (status: PlayReviewStatus) =>
    start(async () => {
      const r = await bulkPlayReviewByFilterAction({ filter, status })
      setConfirmFilter(null)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', `حُدّثت حالة ${r.data.count} سؤالاً (كامل المرشّح) إلى «${STATUS_AR[status]}»`)
      setSelected(new Set())
      router.refresh()
    })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-sm">
        <span className="font-semibold">
          المحدَّد: <span className="tabular">{selected.size}</span>
        </span>
        {BULK.map((b) => (
          <Button key={b.status} size="sm" variant={b.variant} disabled={selected.size === 0} loading={pending} onClick={() => runBulk(b.status)}>
            {b.status === 'APPROVED' ? <CheckCircle2 className="size-4" /> : b.status === 'REJECTED' ? <XCircle className="size-4" /> : <Eye className="size-4" />}
            {b.label}
          </Button>
        ))}
        <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Filter className="size-3.5" /> على كامل المرشّح ({total}):
        </span>
        {BULK.map((b) => (
          <Button key={`f-${b.status}`} size="sm" variant="ghost" disabled={!hasAnyFilter(filter) || total === 0} loading={pending && confirmFilter === b.status} onClick={() => setConfirmFilter(b.status)}>
            {b.label}
          </Button>
        ))}
        {!hasAnyFilter(filter) ? <span className="text-xs text-muted-foreground">(اختر مرشّحاً واحداً على الأقل لتفعيل التطبيق على الكل)</span> : null}
      </div>

      {confirmFilter ? (
        <div role="alertdialog" className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <span>
            سيُغيَّر <strong className="tabular">{total}</strong> سؤالاً يطابق المرشّح الحالي إلى «{STATUS_AR[confirmFilter]}». هذا يشمل الصفحات غير المعروضة. متابعة؟
          </span>
          <Button size="sm" variant="destructive" loading={pending} onClick={() => runFilter(confirmFilter)}>
            نعم، طبّق على الكل
          </Button>
          <Button size="sm" variant="outline" onClick={() => setConfirmFilter(null)}>
            إلغاء
          </Button>
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input type="checkbox" aria-label="تحديد الكل" checked={allChecked} onChange={toggleAll} className="size-4 accent-primary" />
            </TableHead>
            <TableHead>المفتاح / السؤال</TableHead>
            <TableHead>السنة · المادة · الدرس</TableHead>
            <TableHead>النوع</TableHead>
            <TableHead>الصعوبة</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead className="text-center">بلاغات</TableHead>
            <TableHead className="text-center">النتائج</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                لا أسئلة تطابق المرشّح.
              </TableCell>
            </TableRow>
          ) : null}
          {rows.map((r) => (
            <TableRow key={r.id} data-state={selected.has(r.id) ? 'selected' : undefined}>
              <TableCell>
                <input type="checkbox" aria-label={`تحديد ${r.key}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="size-4 accent-primary" />
              </TableCell>
              <TableCell className="max-w-[320px]">
                <Link href={`/admin/play/questions/${r.id}`} className="block font-mono text-xs text-primary hover:underline" dir="ltr">
                  {r.key}
                </Link>
                <p className="truncate text-sm" title={r.questionText}>
                  {r.questionText}
                </p>
                {r.qualityFlags.length ? <p className="truncate text-[11px] text-amber-700 dark:text-amber-300">{r.qualityFlags.join(' · ')}</p> : null}
              </TableCell>
              <TableCell className="text-xs">
                <p className="font-semibold">
                  {r.gradeName}
                  {r.streamCodes.length ? <span className="text-muted-foreground"> ({r.streamCodes.join('، ')})</span> : null}
                </p>
                <p className="text-muted-foreground">
                  {r.subjectName} · {r.lessonName}
                </p>
              </TableCell>
              <TableCell className="text-xs">{typeAr(r.type)}</TableCell>
              <TableCell>
                <Badge variant={r.difficulty === 'HARD' ? 'destructive' : r.difficulty === 'MEDIUM' ? 'warning' : 'success'}>{difficultyAr(r.difficulty)}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <Badge variant={(STATUS_VARIANT as Record<string, 'muted'>)[r.reviewStatus] ?? 'muted'}>{statusAr(r.reviewStatus)}</Badge>
                  {r.isSuspended ? (
                    <Badge variant="destructive">
                      <PauseCircle className="size-3" /> معلَّق
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-center tabular">{r.reportsCount ? <Badge variant="destructive">{r.reportsCount}</Badge> : <span className="text-muted-foreground">0</span>}</TableCell>
              <TableCell className="text-center text-xs tabular text-muted-foreground" title="صحيحة / خاطئة">
                {r.timesCorrect} / {r.timesWrong}
              </TableCell>
              <TableCell className="text-end">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/play/questions/${r.id}`}>فتح</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
