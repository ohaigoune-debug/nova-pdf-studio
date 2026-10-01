import { BookOpenCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EmptyState, Progress } from '@/components/ui/misc'
import { DIFF_AR } from '@/lib/bank-labels'
import { formatDate } from '@/lib/utils'
import type { NodeProgressItem } from '@/server/services/adaptive.service'

/** تقدّم التلميذ بالدرس من التدريب الذاتي (المرحلة 8) — يراه التلميذ وأستاذه */
export function NodeProgress({ items, compact = false, emptyText = 'لا تدريب ذاتي بعد.' }: { items: NodeProgressItem[]; compact?: boolean; emptyText?: string }) {
  if (items.length === 0) return <EmptyState icon={BookOpenCheck} title={emptyText} />
  const bySubject = new Map<string, NodeProgressItem[]>()
  for (const it of items) bySubject.set(it.subjectName, [...(bySubject.get(it.subjectName) ?? []), it])
  return (
    <div className="space-y-4">
      {[...bySubject.entries()].map(([subject, list]) => (
        <div key={subject}>
          <p className="mb-2 text-sm font-bold">{subject}</p>
          <ul className="space-y-3">
            {list.map((s) => (
              <li key={s.nodeId}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 font-semibold">
                    {s.title}
                    {s.attempts < 3 ? <Badge variant="muted">قليل المحاولات</Badge> : null}
                    {s.streak >= 3 ? <Badge variant="success">{s.streak} متتالية</Badge> : null}
                  </span>
                  <span className="tabular">{Math.round(s.score)}%</span>
                </div>
                <Progress value={s.score} tone={s.score < 60 ? 'destructive' : s.score < 80 ? 'warning' : 'success'} />
                {!compact ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {s.correct} صحيح من {s.attempts}
                    {s.masteredDifficulty ? ` · أتقن حتى «${DIFF_AR[s.masteredDifficulty]?.label}»` : ''} · آخر تدريب {formatDate(s.lastAt)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
