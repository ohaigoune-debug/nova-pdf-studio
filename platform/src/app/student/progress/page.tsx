import { TrendingUp } from 'lucide-react'
import { ContentGrid } from '@/components/domain/content-cards'
import { SkillMap } from '@/components/domain/skill-map'
import { Timeline } from '@/components/domain/timeline'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/misc'
import { t } from '@/i18n'
import { percent } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listStudentGrades } from '@/server/queries/student-extras.queries'
import { skillMap, suggestedContentForStudent } from '@/server/services/skills.service'
import { getStudentProfile } from '@/server/services/students.service'

export default async function StudentProgressPage() {
  const actor = await requirePageActor('STUDENT')
  const db = await getDb()
  const [profile, skills, suggestions, grades] = await Promise.all([getStudentProfile(db, actor, actor.studentId!), skillMap(db, actor.studentId!), suggestedContentForStudent(db, actor), listStudentGrades(db, actor)])
  const avgSkill = skills.length ? skills.reduce((s, k) => s + k.score, 0) / skills.length : null
  const avgGrade = grades.length ? (grades.reduce((s, g) => s + (Number(g.score) / Number(g.maxScore)) * 20, 0) / grades.length) : null
  return (
    <>
      <PageHeader title={t('nav.progress')} />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label={t('dashboard.attendanceRate')} value={percent(profile.attendance.rate)} />
        <StatCard label={t('common.sessions')} value={profile.attendance.total} />
        <StatCard label={t('groups.averageScore')} value={avgGrade !== null ? `${Math.round(avgGrade * 10) / 10}/20` : '—'} hint={`${grades.length} تقييم`} />
        <StatCard label={t('dashboard.skillsLevel')} value={percent(avgSkill)} icon={TrendingUp} tone={avgSkill !== null && avgSkill < 60 ? 'warning' : 'success'} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('skills.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <SkillMap items={skills} />
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
      {suggestions.length ? (
        <section className="mt-6 space-y-4">
          <h2 className="text-lg font-extrabold">{t('skills.suggested')}</h2>
          {suggestions.map((s) => (
            <div key={s.skillName}>
              <p className="mb-2 text-sm font-semibold text-muted-foreground">{s.skillName}</p>
              <ContentGrid items={s.items} basePath="/student/lessons" />
            </div>
          ))}
        </section>
      ) : null}
    </>
  )
}
