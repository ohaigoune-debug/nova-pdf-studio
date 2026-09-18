import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import type { AttemptView } from '@/server/services/quizzes.service'

function keyText(item: AttemptView['items'][number]): string | null {
  const k = item.answerKey
  if (!k) return null
  switch (item.type) {
    case 'TRUE_FALSE':
      return k.value ? t('quizzes.trueLabel') : t('quizzes.falseLabel')
    case 'SHORT_ANSWER':
      return Array.isArray(k.accepted) ? (k.accepted as string[]).join(' / ') : null
    case 'FILL_BLANK':
      return Array.isArray(k.blanks) ? (k.blanks as string[][]).map((b) => b[0]).join('، ') : null
    case 'MATCHING':
      return Array.isArray(k.pairs) ? (k.pairs as { left: string; right: string }[]).map((p) => `${p.left} ← ${p.right}`).join('؛ ') : null
    default:
      return null
  }
}

function answerText(item: AttemptView['items'][number]): string {
  const j = item.answerJson ?? {}
  if (item.type === 'MCQ' || item.type === 'IMAGE') {
    const ids = (j.optionIds as string[] | undefined) ?? []
    return item.options.filter((o) => ids.includes(o.id)).map((o) => o.label).join('، ') || '—'
  }
  if (item.type === 'TRUE_FALSE') return typeof j.value === 'boolean' ? (j.value ? t('quizzes.trueLabel') : t('quizzes.falseLabel')) : '—'
  if (item.type === 'FILL_BLANK') return ((j.blanks as string[] | undefined) ?? []).join('، ') || '—'
  if (item.type === 'MATCHING') {
    const pairs = Array.isArray(item.answerKey?.pairs) ? (item.answerKey!.pairs as { left: string; right: string }[]) : null
    const m = (j.matches as Record<string, number> | undefined) ?? {}
    if (!pairs) return Object.keys(m).length ? `${Object.keys(m).length} مطابقات` : '—'
    return pairs.map((p, i) => `${p.left} ← ${pairs[m[String(i)] ?? -1]?.right ?? '—'}`).join('؛ ')
  }
  return item.answerText?.trim() || '—'
}

/** عرض نتيجة محاولة (للطالب بعد الاعتماد، وللأستاذ دائماً) */
export function AttemptResult({ view, showKeys, children }: { view: AttemptView; showKeys: boolean; children?: (item: AttemptView['items'][number], index: number) => React.ReactNode }) {
  return (
    <div className="space-y-3">
      {view.items.map((item, i) => {
        const pendingEssay = item.score === null
        return (
          <Card key={item.questionId} className={cn(item.isCorrect === true && 'border-success/40', item.isCorrect === false && !pendingEssay && 'border-destructive/40')}>
            <CardContent className="space-y-2 p-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5">
                  {pendingEssay ? <Clock className="size-5 text-amber-600" /> : item.isCorrect ? <CheckCircle2 className="size-5 text-success" /> : <XCircle className="size-5 text-destructive" />}
                </span>
                <div className="flex-1">
                  <p className="font-semibold leading-7">
                    {i + 1}. {item.prompt}
                  </p>
                  <p className="text-xs text-muted-foreground tabular">
                    {item.score === null ? t('quizzes.pendingReview') : `${item.score}`} / {item.points}
                  </p>
                </div>
              </div>
              <p className="text-sm">
                <span className="text-muted-foreground">{t('quizzes.yourAnswer')}: </span>
                <span className="whitespace-pre-wrap">{answerText(item)}</span>
              </p>
              {showKeys ? (
                (item.type === 'MCQ' || item.type === 'IMAGE') && item.options.length ? (
                  <p className="text-sm text-success">
                    {t('quizzes.correctAnswer')}: {item.options.filter((o) => o.isCorrect).map((o) => o.label).join('، ')}
                  </p>
                ) : keyText(item) ? (
                  <p className="text-sm text-success">
                    {t('quizzes.correctAnswer')}: {keyText(item)}
                  </p>
                ) : null
              ) : null}
              {children ? children(item, i) : null}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
