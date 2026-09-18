import { TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EmptyState, Progress } from '@/components/ui/misc'
import { t } from '@/i18n'
import { formatShortDate, percent } from '@/lib/utils'
import type { SkillMapItem } from '@/server/services/skills.service'
import { WEAK_THRESHOLD } from '@/server/services/skills.service'

export function SkillMap({ items, compact = false }: { items: SkillMapItem[]; compact?: boolean }) {
  if (items.length === 0) return <EmptyState icon={TrendingUp} title={t('skills.empty')} />
  return (
    <ul className="space-y-3">
      {items.map((s) => (
        <li key={s.skillId}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 font-semibold">
              {s.name}
              {s.confidence < 0.6 ? <Badge variant="muted">{t('skills.lowConfidence')}</Badge> : null}
            </span>
            <span className="tabular">{percent(s.score)}</span>
          </div>
          <Progress value={s.score} tone={s.score < WEAK_THRESHOLD ? 'destructive' : s.score < 75 ? 'warning' : 'success'} />
          {!compact ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t('skills.attempts')}: {s.attempts} · {t('skills.confidence')}: {percent(s.confidence * 100)} · {t('skills.lastUpdated')}: {formatShortDate(s.lastUpdated)}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
