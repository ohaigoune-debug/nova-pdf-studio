import { Cpu } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, PhaseNote, StatCard } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { aiStats } from '@/server/queries/admin-extras.queries'

export default async function AdminAiPage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const s = await aiStats(await getDb(), actor)
  return (
    <>
      <PageHeader title={t('admin.aiTitle')} />
      <PhaseNote phase={6} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="المزوّد" value={s.provider} hint={s.configured ? 'المفتاح مضبوط في البيئة' : 'لا مفتاح — وضع تجريبي'} icon={Cpu} />
        <StatCard label="في الانتظار" value={s.jobs.QUEUED ?? 0} />
        <StatCard label="مكتملة" value={s.jobs.COMPLETED ?? 0} tone="success" />
        <StatCard label="فاشلة" value={s.jobs.FAILED ?? 0} tone={(s.jobs.FAILED ?? 0) > 0 ? 'destructive' : 'default'} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>واجهة المزوّد (AIProvider)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>النظام لا يرتبط بنموذج واحد. تُنفَّذ الاستدعاءات عبر واجهة مجرّدة:</p>
          <ul className="list-disc ps-6 font-mono text-xs" dir="ltr">
            <li>evaluateEssay(submission, rubric) → suggested_score, confidence, mistakes, strengths, weaknesses, skills</li>
            <li>analyzeStudent(studentId)</li>
            <li>generateExercises(skill, level)</li>
            <li>generateTeacherInsights(workspaceId)</li>
          </ul>
          <p className="text-muted-foreground">
            الأستاذ يعتمد/يعدّل/يرفض قبل أن يرى الطالب أي نتيجة. <Badge variant="muted">المرحلة 6</Badge>
          </p>
        </CardContent>
      </Card>
    </>
  )
}
