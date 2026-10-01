import { Dumbbell, Target, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { PracticeStartForm } from '@/components/domain/practice-start-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader, Progress, StatCard } from '@/components/ui/misc'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { practiceOptions, practiceOverview } from '@/server/services/practice.service'

export const dynamic = 'force-dynamic'

/** التدريب الذاتي (المرحلة 7): ابدأ سلسلة، وراجع جلساتك ونقاط ضعفك */
export default async function PracticePage({ searchParams }: { searchParams: Promise<{ subject?: string; node?: string }> }) {
  const actor = await requirePageActor('STUDENT')
  const sp = await searchParams
  const db = await getDb()
  const base = await practiceOptions(db, actor)
  const subjectId = base.subjects.some((s) => s.id === sp.subject) ? sp.subject! : (base.subjects[0]?.id ?? '')
  const [opts, overview] = await Promise.all([subjectId ? practiceOptions(db, actor, subjectId) : Promise.resolve(base), practiceOverview(db, actor)])
  const rate = overview.totals.answered ? Math.round((overview.totals.correct / overview.totals.answered) * 100) : null
  return (
    <div className="space-y-6">
      <PageHeader title="تدريب ذاتي" description="اختر مادة ودرساً، أجب سؤالاً سؤالاً، واعرف فوراً أين تخطئ." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="جلسات" value={overview.totals.sessions} icon={Dumbbell} />
        <StatCard label="أسئلة أُجيبت" value={overview.totals.answered} icon={Target} />
        <StatCard label="نسبة الصواب" value={rate === null ? '—' : `${rate}%`} icon={TrendingUp} tone={rate === null ? 'default' : rate >= 60 ? 'success' : 'warning'} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ابدأ جلسة</CardTitle>
        </CardHeader>
        <CardContent>
          {base.subjects.length === 0 ? (
            <EmptyState icon={Dumbbell} title="لا أسئلة للتدريب بعد" description="حين ينشر الأساتذة أسئلة عامة في البنك بمستواك تظهر هنا." />
          ) : (
            <PracticeStartForm key={subjectId} subjects={base.subjects} nodes={opts.nodes} subjectId={subjectId} nodeId={sp.node ?? null} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>نقاط تحتاج تدريباً</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.weak.length === 0 ? (
              <p className="text-sm text-muted-foreground">{overview.totals.answered < 3 ? 'أجب على بضعة أسئلة أولاً لنرصد ما يحتاج تدريباً.' : 'لا نقاط ضعف واضحة في آخر إجاباتك — أحسنت.'}</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {overview.weak.map((w) => (
                  <li key={w.nodeId}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-semibold">{w.title}</span>
                      <span className="tabular text-xs text-muted-foreground">
                        {w.correct} / {w.total}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={(w.correct / w.total) * 100} tone="warning" className="flex-1" />
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/student/practice?subject=${w.subjectId}&node=${w.nodeId}`}>تدرّب</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {overview.bySubject.length ? (
              <ul className="mt-4 space-y-2 border-t pt-3 text-sm">
                {overview.bySubject.map((s) => (
                  <li key={s.subjectId}>
                    <div className="mb-1 flex items-center justify-between">
                      <span>{s.name}</span>
                      <span className="tabular text-xs text-muted-foreground">{Math.round((s.correct / s.total) * 100)}%</span>
                    </div>
                    <Progress value={(s.correct / s.total) * 100} tone={s.correct / s.total >= 0.6 ? 'success' : 'warning'} />
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>آخر الجلسات</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا جلسات بعد.</p>
            ) : (
              <ul className="divide-y text-sm">
                {overview.sessions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                    <Link href={`/student/practice/${s.id}`} className="min-w-0 hover:underline">
                      <p className="truncate font-semibold">
                        {s.subjectName ?? 'مادة'}
                        {s.nodeTitle ? ` — ${s.nodeTitle}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(s.startedAt)}</p>
                    </Link>
                    {s.status === 'FINISHED' ? <Badge variant={(s.scorePct ?? 0) >= 60 ? 'success' : 'warning'}>{s.scorePct ?? 0}%</Badge> : <Badge variant="secondary">جارية</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
