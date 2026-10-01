'use client'

import { Archive, CheckCircle2, Pencil, Star, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { approveReviewedAction, deleteBankQuestionAction, setBankStatusAction, toggleFavoriteAction } from '@/server/actions/bank.actions'
import { DIFF_AR, EXAM_KIND_AR, KIND_AR, TYPE_AR } from '@/lib/bank-labels'
import type { BankListItem } from '@/server/services/question-bank.service'

const STATUS_AR: Record<string, { label: string; variant: 'success' | 'warning' | 'muted' | 'secondary' }> = { PUBLISHED: { label: 'منشور', variant: 'success' }, NEEDS_REVIEW: { label: 'بانتظار المراجعة', variant: 'warning' }, DRAFT: { label: 'مسودة', variant: 'secondary' }, ARCHIVED: { label: 'مؤرشف', variant: 'muted' } }

/** قائمة البنك: بطاقات بالتصنيف الكامل، مفضّلة، وأزرار المراجعة/الأرشفة لأسئلة الأستاذ نفسه */
export function BankList({ items, ownWorkspaceId, review, nextHref }: { items: BankListItem[]; ownWorkspaceId: string | null; review: boolean; nextHref: string | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [picked, setPicked] = useState<Set<string>>(() => new Set(items.filter((i) => i.status === 'NEEDS_REVIEW').map((i) => i.id)))
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, ok: string) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) toast('error', r.error!.message)
      else {
        if (ok) toast('success', ok)
        router.refresh()
      }
    })
  const own = (q: BankListItem) => q.workspaceId === ownWorkspaceId

  if (items.length === 0) return <EmptyState title={review ? 'لا أسئلة بانتظار المراجعة' : 'لا أسئلة تطابق البحث'} description={review ? 'ارفع اختباراً قديماً من «استيراد» فتظهر أسئلته هنا لتراجعها.' : 'غيّر الفلاتر، أو أضف سؤالاً، أو استورد من ملف أو اختبار.'} />
  return (
    <div className="space-y-3">
      {review ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-warning/10 p-3 text-sm">
          <span>راجع كل سؤال (عدّله إن لزم) ثم اعتمد المحدّد. ما لا يصلح للنشر (اختيار متعدد بلا إجابة صحيحة مثلاً) يبقى هنا حتى تصحّحه.</span>
          <Button size="sm" onClick={() => run(() => approveReviewedAction([...picked]), 'اعتُمد')} loading={pending} disabled={picked.size === 0}>
            <CheckCircle2 className="size-4" /> اعتماد المحدّد ({picked.size})
          </Button>
        </div>
      ) : null}
      <ul className="space-y-2">
        {items.map((q) => (
          <li key={q.id} className="rounded-lg border bg-card p-3">
            <div className="flex gap-3">
              {review ? <input type="checkbox" className="mt-1 size-4 shrink-0" checked={picked.has(q.id)} onChange={() => setPicked((s) => { const n = new Set(s); n.has(q.id) ? n.delete(q.id) : n.add(q.id); return n })} aria-label="تحديد" /> : null}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge variant="secondary">{KIND_AR[q.kind] ?? q.kind}</Badge>
                  <Badge variant="outline">{TYPE_AR[q.type] ?? q.type}</Badge>
                  <Badge variant={DIFF_AR[q.difficulty]?.variant ?? 'default'}>{DIFF_AR[q.difficulty]?.label}</Badge>
                  <Badge variant="muted">{Number(q.points)} ن</Badge>
                  {q.estimatedMinutes ? <Badge variant="muted">{q.estimatedMinutes} د</Badge> : null}
                  {q.subjectName ? <span className="text-muted-foreground">{q.subjectName}</span> : null}
                  {q.levelName ? <span className="text-muted-foreground">· {q.levelName}</span> : null}
                  {q.streamName ? <span className="text-muted-foreground">· {q.streamName}</span> : null}
                  {q.nodeTitle ? <span className="text-muted-foreground">· {q.nodeTitle}</span> : null}
                  {q.schoolTerm ? <span className="text-muted-foreground">· الفصل {q.schoolTerm}</span> : null}
                  {q.status !== 'PUBLISHED' || !own(q) ? <Badge variant={STATUS_AR[q.status]?.variant ?? 'muted'}>{own(q) ? STATUS_AR[q.status]?.label : q.workspaceId ? 'أستاذ آخر' : 'بنك Madrasadz'}</Badge> : null}
                  {q.solution ? <Badge variant="success">مع حلّ</Badge> : null}
                  {q.children ? <Badge variant="secondary">{q.children} أسئلة فرعية</Badge> : null}
                </div>
                <Link href={`/teacher/bank/${q.id}`} className="block">
                  {q.title ? <p className="font-semibold">{q.title}</p> : null}
                  <p className="line-clamp-3 whitespace-pre-line text-sm" dir="auto">
                    {q.body}
                  </p>
                </Link>
                <p className="text-xs text-muted-foreground">
                  {q.sourceLabel ?? q.sourceName ?? 'مصدر: الأستاذ'}
                  {q.sourceYear ? ` · ${q.sourceYear}` : ''}
                  {q.examKind ? ` · ${EXAM_KIND_AR[q.examKind]}` : ''}
                  {q.keywords.length ? ` · ${q.keywords.join('، ')}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Button size="sm" variant="ghost" title={q.favorite ? 'إزالة من المفضّلة' : 'إضافة إلى المفضّلة'} onClick={() => run(() => toggleFavoriteAction(q.id), '')} loading={pending}>
                  <Star className={`size-4 ${q.favorite ? 'fill-amber-400 text-amber-500' : ''}`} />
                </Button>
                {own(q) ? (
                  <>
                    <Button asChild size="sm" variant="ghost" title="تعديل">
                      <Link href={`/teacher/bank/${q.id}/edit`}>
                        <Pencil className="size-4" />
                      </Link>
                    </Button>
                    {q.status === 'NEEDS_REVIEW' ? (
                      <Button size="sm" variant="ghost" title="اعتماد" onClick={() => run(() => approveReviewedAction([q.id]), 'اعتُمد')} loading={pending}>
                        <CheckCircle2 className="size-4" />
                      </Button>
                    ) : q.status !== 'ARCHIVED' ? (
                      <Button size="sm" variant="ghost" title="أرشفة" onClick={() => run(() => setBankStatusAction(q.id, 'ARCHIVED'), 'أُرشف')} loading={pending}>
                        <Archive className="size-4" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" title="إعادة النشر" onClick={() => run(() => setBankStatusAction(q.id, 'PUBLISHED'), 'نُشر')} loading={pending}>
                        <CheckCircle2 className="size-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" title="حذف" onClick={() => confirm('حذف السؤال وأسئلته الفرعية؟') && run(() => deleteBankQuestionAction(q.id), 'حُذف')} loading={pending}>
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {nextHref ? (
        <div className="text-center">
          <Button asChild variant="outline">
            <Link href={nextHref}>المزيد</Link>
          </Button>
        </div>
      ) : null}
    </div>
  )
}
