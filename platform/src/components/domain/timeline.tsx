import { AlertTriangle, BookOpen, CalendarCheck, CalendarX, CheckCircle2, Clock, GraduationCap, LogOut, RefreshCcw, UserPlus, type LucideIcon } from 'lucide-react'
import { EmptyState } from '@/components/ui/misc'
import { t } from '@/i18n'
import { cn, formatShortDate, formatTime } from '@/lib/utils'

const icons: Record<string, { icon: LucideIcon; tone: string }> = {
  ENROLLED: { icon: UserPlus, tone: 'bg-primary/15 text-primary' },
  ATTENDED: { icon: CalendarCheck, tone: 'bg-success/15 text-success' },
  LATE: { icon: Clock, tone: 'bg-warning/25 text-amber-700 dark:text-amber-300' },
  ABSENT: { icon: CalendarX, tone: 'bg-destructive/15 text-destructive' },
  EXCUSED: { icon: CheckCircle2, tone: 'bg-secondary text-secondary-foreground' },
  SUSPENDED: { icon: AlertTriangle, tone: 'bg-destructive/15 text-destructive' },
  REACTIVATED: { icon: RefreshCcw, tone: 'bg-success/15 text-success' },
  LEFT: { icon: LogOut, tone: 'bg-muted text-muted-foreground' },
  ASSIGNMENT_SUBMITTED: { icon: BookOpen, tone: 'bg-primary/15 text-primary' },
  GRADED: { icon: GraduationCap, tone: 'bg-primary/15 text-primary' },
  LESSON_VIEWED: { icon: BookOpen, tone: 'bg-muted text-muted-foreground' },
  QUIZ_COMPLETED: { icon: CheckCircle2, tone: 'bg-success/15 text-success' }
}

export function Timeline({ items }: { items: { id: string; type: string; title: string; occurredAt: Date }[] }) {
  if (items.length === 0) return <EmptyState title={t('common.empty')} />
  return (
    <ol className="relative space-y-4 border-s ps-6">
      {items.map((it) => {
        const meta = icons[it.type] ?? icons.LESSON_VIEWED!
        const Icon = meta.icon
        return (
          <li key={it.id} className="relative">
            <span className={cn('absolute -start-[37px] top-0 flex size-7 items-center justify-center rounded-full border-2 border-background', meta.tone)}>
              <Icon className="size-3.5" />
            </span>
            <p className="text-sm font-semibold">{it.title}</p>
            <p className="text-[11px] text-muted-foreground tabular">
              {formatShortDate(it.occurredAt)} · {formatTime(it.occurredAt)}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
