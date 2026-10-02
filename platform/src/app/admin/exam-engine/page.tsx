import { AlertTriangle, BookOpenCheck, Cpu, FileStack, ListChecks, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { DocumentsTable, EngineControls } from '@/components/domain/exam-engine-admin'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { EXAM_DOC_STATUSES, type ExamDocStatus } from '@/server/db/schema/enums'
import { DOC_STATUS_AR, ORIGIN_AR } from '@/lib/exam-engine-labels'
import { engineStats, listDocuments } from '@/server/services/exam-engine.service'

export const dynamic = 'force-dynamic'

type Q = { status?: string; q?: string }

/** لوحة محرّك الامتحانات: الأعداد، الطابور، الاستهلاك، والوثائق بإجراءاتها */
export default async function ExamEngineAdminPage({ searchParams }: { searchParams: Promise<Q> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const q = await searchParams
  const db = await getDb()
  const status = (EXAM_DOC_STATUSES as readonly string[]).includes(q.status ?? '') ? (q.status as ExamDocStatus) : null
  const [stats, docs] = await Promise.all([engineStats(db, actor), listDocuments(db, actor, { status, q: q.q ?? null }, 200)])
  const chip = (on: boolean) => cn('rounded-full border px-3 py-1 text-sm', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')
  return (
    <>
      <PageHeader title="محرّك الامتحانات" description="أرشفة البكالوريات ← تقسيمها تمارين مصنّفة بالمنهاج ← مراجعة ← بنك مركزي يبني منه الأساتذة الفروض والاختبارات. المرحلة 1: الرياضيات 3AS." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="وثائق مسجَّلة" value={stats.archive.registered} hint={`${stats.docs.PENDING} معلّقة · ${stats.docs.PROCESSING} قيد المعالجة`} icon={FileStack} />
        <StatCard label="بانتظار المراجعة" value={stats.docs.NEEDS_REVIEW} hint={`${stats.questions.review} تمريناً`} icon={ListChecks} tone={stats.docs.NEEDS_REVIEW ? 'warning' : 'default'} />
        <StatCard label="منشورة" value={stats.docs.PUBLISHED} hint={`${stats.questions.published} تمريناً في البنك المركزي`} icon={BookOpenCheck} tone="success" />
        <StatCard label="فشلت" value={stats.docs.FAILED} hint="مصوّرة، بلا ملف، أو خطأ" icon={AlertTriangle} tone={stats.docs.FAILED ? 'destructive' : 'default'} />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EngineControls stats={stats} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="size-5 text-primary" /> الذكاء الاصطناعي (30 يوماً)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              نداءات: <strong className="tabular">{stats.ai.calls}</strong>
              {stats.ai.failed ? <span className="text-destructive"> · فاشلة {stats.ai.failed}</span> : null}
            </p>
            <p>
              رموز: <span className="tabular">{stats.ai.inputTokens.toLocaleString('en')}</span> دخل · <span className="tabular">{stats.ai.outputTokens.toLocaleString('en')}</span> خرج
            </p>
            <p>
              تكلفة مقدّرة: <strong className="tabular">${stats.ai.costUsd.toFixed(3)}</strong>
            </p>
            <p className="pt-2 text-xs text-muted-foreground">
              جودة التصنيف: <Badge variant={stats.questions.unclassified ? 'warning' : 'muted'}>{stats.questions.unclassified} بلا درس</Badge> <Badge variant={stats.questions.lowConfidence ? 'warning' : 'muted'}>{stats.questions.lowConfidence} ثقة منخفضة</Badge>
            </p>
            <p className="flex flex-wrap gap-1 pt-1 text-xs">
              {Object.entries(stats.questions.byOrigin).map(([o, n]) => (
                <Badge key={o} variant={o === 'AI_GENERATED' ? 'gold' : 'secondary'}>
                  {o === 'AI_GENERATED' ? <Sparkles className="size-3" /> : null}
                  {ORIGIN_AR[o] ?? o}: {n}
                </Badge>
              ))}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            الوثائق
            <span className="flex flex-wrap gap-1.5 text-sm font-normal">
              <Link href="/admin/exam-engine" className={chip(!status)}>
                الكل
              </Link>
              {EXAM_DOC_STATUSES.map((s) => (
                <Link key={s} href={`/admin/exam-engine?status=${s}`} className={chip(status === s)}>
                  {DOC_STATUS_AR[s]} ({stats.docs[s]})
                </Link>
              ))}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DocumentsTable docs={docs} />
        </CardContent>
      </Card>
    </>
  )
}
