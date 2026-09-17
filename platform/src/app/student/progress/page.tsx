import { TrendingUp } from 'lucide-react'
import { Timeline } from '@/components/domain/timeline'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader, PhaseNote, Progress, StatCard } from '@/components/ui/misc'
import { t } from '@/i18n'
import { percent } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listStudentSkills } from '@/server/queries/student-extras.queries'
import { getStudentProfile } from '@/server/services/students.service'

export default async function StudentProgressPage() {
  const actor = await requirePageActor('STUDENT')
  const db = await getDb()
  const [profile, skills] = await Promise.all([getStudentProfile(db, actor, actor.studentId!), listStudentSkills(db, actor)])
  return (
    <>
      <PageHeader title={t('nav.progress')} />
      <PhaseNote phase={6} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label={t('dashboard.attendanceRate')} value={percent(profile.attendance.rate)} />
        <StatCard label={t('common.sessions')} value={profile.attendance.total} />
        <StatCard label={t('dashboard.skillsLevel')} value={skills.length ? percent(skills.reduce((s, k) => s + Number(k.score), 0) / skills.length) : '—'} icon={TrendingUp} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('studentPages.skillsTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {skills.length === 0 ? (
              <EmptyState title={t('studentPages.skillsEmpty')} />
            ) : (
              <ul className="space-y-3">
                {skills.map((s) => (
                  <li key={s.code}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-semibold">{s.name}</span>
                      <span className="tabular">{percent(Number(s.score))}</span>
                    </div>
                    <Progress value={Number(s.score)} tone={Number(s.score) < 60 ? 'warning' : 'success'} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('studentPages.timeline')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline items={profile.timeline} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
