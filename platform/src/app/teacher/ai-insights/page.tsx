import { Brain } from 'lucide-react'
import Link from 'next/link'
import { Alert, EmptyState, PageHeader, PhaseNote } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { dataInsights } from '@/server/queries/teacher-extras.queries'

export default async function AiInsightsPage() {
  const actor = await requirePageActor('TEACHER')
  const insights = await dataInsights(await getDb(), actor)
  return (
    <>
      <PageHeader title={t('teacherPages.aiTitle')} description="توصيات مبنية على بياناتك الحقيقية (الحضور الآن، والمهارات والعلامات بعد المرحلة 6)." />
      <PhaseNote phase={7} />
      {insights.length === 0 ? (
        <EmptyState icon={Brain} title={t('teacherPages.aiEmpty')} />
      ) : (
        <div className="space-y-3">
          {insights.map((i, idx) => (
            <Alert key={idx} tone={i.tone}>
              {i.href ? (
                <Link href={i.href} className="hover:underline">
                  {i.text}
                </Link>
              ) : (
                i.text
              )}
            </Alert>
          ))}
        </div>
      )}
    </>
  )
}
