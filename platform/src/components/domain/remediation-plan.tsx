import { BookOpen, ClipboardList, Dumbbell } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/misc'
import { t } from '@/i18n'
import type { RemediationStep } from '@/server/services/skills.service'

function Column({ icon: Icon, title, children }: { icon: typeof BookOpen; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1 text-xs font-bold text-muted-foreground">
        <Icon className="size-3.5" /> {title}
      </p>
      <ul className="space-y-1 text-sm">{children}</ul>
    </div>
  )
}

export function RemediationPlan({ steps }: { steps: RemediationStep[] }) {
  if (steps.length === 0) return null
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-extrabold">{t('remediation.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('remediation.hint')}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {steps.map((s, i) => {
          const empty = s.lessons.length + s.exercises.length + s.quizzes.length === 0
          return (
            <Card key={s.skillId}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span>
                    {i + 1}. {s.skillName}
                  </span>
                  <Badge variant="warning">{Math.round(s.score)}%</Badge>
                </CardTitle>
                <Progress value={s.score} tone="warning" />
              </CardHeader>
              <CardContent className="space-y-3">
                {empty ? <p className="text-sm text-muted-foreground">{t('remediation.noContent')}</p> : null}
                {s.lessons.length ? (
                  <Column icon={BookOpen} title={t('remediation.lessons')}>
                    {s.lessons.map((l) => (
                      <li key={l.id}>
                        <Link href={`/student/lessons/${l.slug}`} className="hover:underline">
                          {l.title}
                        </Link>
                      </li>
                    ))}
                  </Column>
                ) : null}
                {s.exercises.length ? (
                  <Column icon={Dumbbell} title={t('remediation.exercises')}>
                    {s.exercises.map((l) => (
                      <li key={l.id}>
                        <Link href={`/student/lessons/${l.slug}`} className="hover:underline">
                          {l.title}
                        </Link>
                      </li>
                    ))}
                  </Column>
                ) : null}
                {s.quizzes.length ? (
                  <Column icon={ClipboardList} title={t('remediation.quizzes')}>
                    {s.quizzes.map((q) => (
                      <li key={q.id} className="flex items-center justify-between gap-2">
                        <Link href={`/student/quizzes/${q.id}`} className="hover:underline">
                          {q.title}
                        </Link>
                        {q.bestScore !== null ? (
                          <span className="text-xs text-muted-foreground tabular">
                            {t('remediation.best')} {q.bestScore}/{Number(q.maxScore)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </Column>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
