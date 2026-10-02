import { ArrowRight, Download, ExternalLink, FileCheck2, ListChecks } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, PageHeader } from '@/components/ui/misc'
import { DIFF_AR } from '@/lib/bank-labels'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { archiveDocument } from '@/server/services/exam-engine.service'
import { RESOURCE_TYPE_AR } from '@/server/services/library.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'موضوع من الأرشيف' }

const SESSION_AR: Record<string, string> = { NORMAL: 'الدورة الرئيسية', MAKEUP: 'الدورة الاستدراكية', MOCK: 'تجريبية' }

/** وثيقة في الأرشيف: الموضوع (معاينة داخل الموقع أو عند المصدر)، التصحيح، والتمارين المستخرجة منها */
export default async function ArchiveDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await getCurrentActor()
  let d
  try {
    d = await archiveDocument(await getDb(), id, { admin: actor?.role === 'SUPER_ADMIN' })
  } catch (e) {
    if (e instanceof AppError) notFound()
    throw e
  }
  const r = d.resource
  const canBuild = actor?.role === 'TEACHER'
  const published = d.exercises.filter((e) => e.status === 'PUBLISHED')
  return (
    <div className="container max-w-5xl py-10">
      <PageHeader
        title={r.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {r.official ? (
              <Badge variant="success">
                <FileCheck2 className="size-3" /> رسمي
              </Badge>
            ) : null}
            <Badge variant="secondary">{RESOURCE_TYPE_AR[r.type as keyof typeof RESOURCE_TYPE_AR] ?? r.type}</Badge>
            {r.year ? <Badge variant="muted">{r.year}</Badge> : null}
            {r.session ? <Badge variant="outline">{SESSION_AR[r.session] ?? r.session}</Badge> : null}
            <span>{[d.subjectName, d.levelName, d.streamName].filter(Boolean).join(' · ')}</span>
          </span>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/archive">
              <ArrowRight className="size-4" /> الأرشيف
            </Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {r.fileUrl ? (
          <Button asChild size="sm">
            <a href={r.fileUrl} target="_blank" rel="noopener noreferrer">
              <Download className="size-4" /> الموضوع (PDF)
            </a>
          </Button>
        ) : null}
        {d.solution?.fileUrl ? (
          <Button asChild size="sm" variant="outline">
            <a href={d.solution.fileUrl} target="_blank" rel="noopener noreferrer">
              <Download className="size-4" /> التصحيح النموذجي
            </a>
          </Button>
        ) : null}
        {r.sourceUrl ? (
          <Button asChild size="sm" variant="ghost">
            <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" /> الصفحة الأصلية عند المصدر
            </a>
          </Button>
        ) : null}
      </div>

      {d.previewUrl ? (
        <Card className="mb-6 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">معاينة الموضوع</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <iframe src={d.previewUrl} title="معاينة الموضوع" className="h-[70vh] w-full border-0 bg-muted" />
          </CardContent>
        </Card>
      ) : r.fileUrl ? (
        <Alert tone="info" className="mb-6">
          المعاينة داخل الموقع تتاح بعد أن يعالج المشرف هذه الوثيقة (تُخزَّن نسخة محلية). إلى ذلك الحين: زرّ «الموضوع (PDF)» يفتحه من المصدر.
        </Alert>
      ) : null}
      {d.solution?.previewUrl ? (
        <details className="mb-6 rounded-xl border bg-card">
          <summary className="cursor-pointer px-4 py-3 font-bold">معاينة التصحيح النموذجي</summary>
          <iframe src={d.solution.previewUrl} title="معاينة التصحيح" className="h-[70vh] w-full border-0 bg-muted" />
        </details>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="size-5 text-primary" /> التمارين المستخرجة من هذا الموضوع
            <Badge variant="muted">{published.length}</Badge>
            {d.document?.review && actor?.role === 'SUPER_ADMIN' ? <Badge variant="warning">{d.document.review} بانتظار المراجعة</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {d.exercises.length === 0 ? (
            <p className="text-muted-foreground">{d.document ? (d.document.status === 'FAILED' ? 'تعذّرت معالجة هذه الوثيقة بعد.' : d.document.status === 'NEEDS_REVIEW' ? 'استُخرجت التمارين وهي بانتظار اعتماد المشرف.' : 'لم تُعالَج هذه الوثيقة بعد.') : 'لم تُسجَّل هذه الوثيقة في محرّك الامتحانات بعد؛ تمارينها تظهر هنا بعد المعالجة والاعتماد.'}</p>
          ) : (
            <ol className="space-y-2">
              {d.exercises.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {e.topicNo ? `الموضوع ${e.topicNo === 1 ? 'الأول' : 'الثاني'} — ` : ''}
                      {e.title ?? `التمرين ${e.exerciseNo ?? ''}`}
                      {e.status === 'NEEDS_REVIEW' ? <Badge variant="warning" className="ms-2">للمراجعة</Badge> : null}
                    </p>
                    <p className="line-clamp-2 text-muted-foreground" dir="auto">
                      {e.body}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                      {e.nodeTitle ? <Badge variant="default">{e.nodeTitle}</Badge> : <Badge variant="muted">بلا درس محدّد</Badge>}
                      <Badge variant={DIFF_AR[e.difficulty]?.variant ?? 'default'}>{DIFF_AR[e.difficulty]?.label}</Badge>
                      <Badge variant="muted">{e.points} ن</Badge>
                      {e.hasSolution ? <Badge variant="success">مع الحلّ</Badge> : null}
                      {e.children ? <Badge variant="outline">{e.children} أسئلة فرعية</Badge> : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {e.status === 'PUBLISHED' ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/library/q/${e.id}`}>عرض</Link>
                      </Button>
                    ) : null}
                    {canBuild && e.status === 'PUBLISHED' ? (
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/teacher/bank?scope=central&q=${encodeURIComponent((e.title ?? e.body).slice(0, 40))}`}>إلى البنك</Link>
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
      <p className="mt-4 text-xs text-muted-foreground">
        {d.source?.attribution}
        {r.originalAuthor ? ` · ${r.originalAuthor}` : ''} · أُضيف إلى الأرشيف في {r.createdAt.toLocaleDateString('ar-DZ')}.
      </p>
    </div>
  )
}
