import { Brain } from 'lucide-react'
import Link from 'next/link'
import { AiInsightsPanel } from '@/components/domain/ai-insights-panel'
import { Alert, EmptyState, PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { dataInsights } from '@/server/queries/teacher-extras.queries'
import { latestTeacherInsights } from '@/server/services/ai.service'

export default async function AiInsightsPage() {
  const actor = await requirePageActor('TEACHER')
  const db = await getDb()
  const [insights, ai] = await Promise.all([dataInsights(db, actor), latestTeacherInsights(db, actor)])
  return (
    <>
      <PageHeader title={t('teacherPages.aiTitle')} description="حقائق مستخرجة من بياناتك الحقيقية (الحضور، المهارات، الواجبات) ثم ملخص وتوصيات يصوغها المزوّد فوقها." />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {insights.length === 0 ? (
            <EmptyState icon={Brain} title={t('teacherPages.aiEmpty')} />
          ) : (
            insights.map((i, idx) => (
              <Alert key={idx} tone={i.tone}>
                {i.href ? (
                  <Link href={i.href} className="hover:underline">
                    {i.text}
                  </Link>
                ) : (
                  i.text
                )}
              </Alert>
            ))
          )}
        </div>
        <AiInsightsPanel insights={ai} />
      </div>
    </>
  )
}
