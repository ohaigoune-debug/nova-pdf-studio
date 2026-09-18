import { Bot, Cpu, ListChecks, TriangleAlert } from 'lucide-react'
import { AiSettingsForm } from '@/components/domain/ai-settings-form'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/misc'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { aiAdminStats } from '@/server/services/ai.service'

export default async function AdminAiPage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const s = await aiAdminStats(await getDb(), actor)
  const failed = (s.jobs.FAILED ?? 0) + (s.evaluations.FAILED ?? 0)
  return (
    <>
      <PageHeader title={t('admin.aiTitle')} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('ai.provider')} value={<span dir="ltr">{s.provider.name}</span>} hint={s.provider.configured ? `${t('ai.model')}: ${s.provider.model}` : 'وضع تجريبي (بلا مفتاح) — اضبط AI_PROVIDER و AI_API_KEY في البيئة'} icon={Cpu} />
        <StatCard label={t('ai.evaluationsTitle')} value={(s.evaluations.COMPLETED ?? 0) + (s.evaluations.PENDING ?? 0) + (s.evaluations.FAILED ?? 0)} hint={`${s.evaluations.PENDING ?? 0} قيد المعالجة`} icon={Bot} />
        <StatCard label={t('ai.decisionsTitle')} value={(s.decisions.APPROVED ?? 0) + (s.decisions.EDITED ?? 0) + (s.decisions.REJECTED ?? 0)} hint={`${t('ai.decisionApproved')} ${s.decisions.APPROVED ?? 0} · ${t('ai.decisionEdited')} ${s.decisions.EDITED ?? 0} · ${t('ai.decisionRejected')} ${s.decisions.REJECTED ?? 0}`} icon={ListChecks} tone="success" />
        <StatCard label="مهام فاشلة" value={failed} icon={TriangleAlert} tone={failed > 0 ? 'destructive' : 'default'} hint={`${t('ai.inlineWorker')}: ${s.inlineWorker ? t('ai.on') : t('ai.off')} · في الانتظار ${s.jobs.QUEUED ?? 0}`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>الإعدادات</CardTitle>
          </CardHeader>
          <CardContent>
            <AiSettingsForm autoEvaluate={s.settings.autoEvaluate} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>واجهة المزوّد (AIProvider)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>النظام لا يرتبط بنموذج واحد؛ الاختيار من البيئة فقط ولا يصل مفتاح إلى المتصفح. الاستدعاءات داخل مهام خلفية:</p>
            <ul className="list-disc ps-6 font-mono text-xs" dir="ltr">
              <li>evaluateEssay(answer, rubric) → suggestedScore, confidence, breakdown, strengths, weaknesses, mistakes, skills</li>
              <li>generateTeacherInsights(facts) → summary, nextLessonSuggestions</li>
            </ul>
            <p className="text-muted-foreground">
              القواعد: الذكاء الاصطناعي يقترح فقط؛ العلامة تُكتب بيد الأستاذ (اعتماد/تعديل/رفض) ولا يرى الطالب شيئاً قبل الاعتماد. <Badge variant="muted">مسار `jobs` + Cron: POST /api/v1/jobs/run</Badge>
            </p>
          </CardContent>
        </Card>
      </div>
      {s.failures.length ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{t('ai.recentFailures')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-xs">
              {s.failures.map((f) => (
                <li key={f.id} className="flex flex-wrap gap-2 border-b py-1 last:border-0">
                  <Badge variant="destructive">{f.type}</Badge>
                  <span className="tabular text-muted-foreground">{formatDateTime(f.finishedAt)}</span>
                  <span className="font-mono" dir="ltr">
                    {f.error}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}
