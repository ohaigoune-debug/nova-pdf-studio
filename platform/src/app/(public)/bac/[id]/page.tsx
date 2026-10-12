import { ArrowRight, Download, ExternalLink, FileCheck2, ListChecks } from 'lucide-react'
import Link from 'next/link'
import { PdfPages } from '@/components/domain/pdf-pages'
import { notFound } from 'next/navigation'
import { BacExercises } from '@/components/domain/bac-exercises'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, PageHeader } from '@/components/ui/misc'
import { SESSION_AR, TOPIC_AR, topicNumberOf } from '@/lib/bac-bank'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { examExercises } from '@/server/services/bac-bank.service'
import { archiveDocument } from '@/server/services/exam-engine.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'موضوع بكالوريا' }

/** صفحة الموضوع: PDF (معاينة داخل الموقع) + التمارين بأسئلتها وحلولها (إظهار الحلّ لكل سؤال) + الحلّ المفصّل + وضع تفاعلي */
export default async function BacExamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string }> }) {
  const { id } = await params
  const { mode } = await searchParams
  const actor = await getCurrentActor()
  const admin = actor?.role === 'SUPER_ADMIN'
  const db = await getDb()
  let d
  try {
    d = await archiveDocument(db, id, { admin })
  } catch (e) {
    if (e instanceof AppError) notFound()
    throw e
  }
  const r = d.resource
  const exercises = d.document ? await examExercises(db, d.document.id, { admin }) : []
  const topic = topicNumberOf(r.title)
  const math = exercises.some((e) => /\$[^$]+\$/.test(e.body + (e.solution ?? '') + e.children.map((c) => c.body).join('')))
  return (
    <div className="container max-w-5xl py-10">
      {math || exercises.length ? <link rel="stylesheet" href="/katex/katex.min.css" /> : null}
      <PageHeader
        title={r.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="default">BAC {r.year ?? '—'}</Badge>
            {d.streamName ? <Badge variant="secondary">{d.streamName}</Badge> : null}
            {d.subjectName ? <Badge variant="outline">{d.subjectName}</Badge> : null}
            {topic ? <Badge variant="muted">{TOPIC_AR(topic)}</Badge> : null}
            {r.session && r.session !== 'NORMAL' ? <Badge variant="outline">{SESSION_AR[r.session] ?? r.session}</Badge> : null}
            {r.official ? (
              <Badge variant="success">
                <FileCheck2 className="size-3" /> رسمي
              </Badge>
            ) : null}
          </span>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/bac">
              <ArrowRight className="size-4" /> بنك البكالوريا
            </Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {r.fileUrl ? (
          <Button asChild size="sm">
            <a href={r.fileUrl} target="_blank" rel="noopener noreferrer">
              <Download className="size-4" /> تحميل الموضوع (PDF)
            </a>
          </Button>
        ) : null}
        {d.solution?.fileUrl ? (
          <Button asChild size="sm" variant="outline">
            <a href={d.solution.fileUrl} target="_blank" rel="noopener noreferrer">
              <Download className="size-4" /> الحلّ النموذجي (PDF)
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
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">الموضوع</CardTitle>
            {/* على iPhone لا تُعرض ملفات PDF داخل الإطار غالباً: الزرّ يفتحها في عارض الهاتف */}
            <span className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <a href={`/library/r/${r.id}`} target="_blank" rel="noopener">
                  <Download className="size-4" /> فتح الموضوع
                </a>
              </Button>
              {d.solution?.previewUrl ? (
                <Button asChild size="sm" variant="outline">
                  <a href={`/library/r/${r.id}?part=solution`} target="_blank" rel="noopener">
                    فتح الحلّ
                  </a>
                </Button>
              ) : null}
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <PdfPages src={d.previewUrl} openHref={`/library/r/${r.id}`} />
          </CardContent>
        </Card>
      ) : r.fileUrl ? (
        <Alert tone="info" className="mb-6">
          المعاينة داخل الموقع تتاح بعد معالجة المشرف لهذا الموضوع (تُخزَّن نسخة محلية). إلى ذلك الحين يفتح زرّ «تحميل الموضوع» الملف من مصدره.
        </Alert>
      ) : null}
      {d.solution?.previewUrl ? (
        <details className="mb-6 rounded-xl border bg-card">
          <summary className="cursor-pointer px-4 py-3 font-bold">الحلّ النموذجي الرسمي (معاينة)</summary>
          <PdfPages src={d.solution.previewUrl} openHref={`/library/r/${r.id}?part=solution`} />
        </details>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="size-5 text-primary" /> التمارين والحلول <Badge variant="muted">{exercises.length}</Badge>
            {d.document?.review && admin ? <Badge variant="warning">{d.document.review} بانتظار المراجعة</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {exercises.length === 0 ? (
            <p className="text-sm text-muted-foreground">{d.document ? (d.document.status === 'FAILED' ? 'تعذّرت قراءة هذا الموضوع آلياً (ملف مصوّر) — سيُراجَع يدوياً.' : d.document.status === 'NEEDS_REVIEW' || d.document.status === 'VERIFIED' ? 'استُخرجت التمارين وهي بانتظار اعتماد المشرف.' : 'لم يُعالَج هذا الموضوع بعد.') : 'تظهر التمارين والحلول هنا بعد معالجة المشرف للموضوع واعتماده.'}</p>
          ) : (
            <BacExercises exercises={exercises} interactive={mode === 'interactive'} />
          )}
        </CardContent>
      </Card>
      <p className="mt-4 text-xs text-muted-foreground">
        {d.source?.attribution}
        {r.originalAuthor ? ` · ${r.originalAuthor}` : ''} · الحلول المفصّلة من إعداد منصة مدرسة وتُراجَع قبل نشرها.
      </p>
    </div>
  )
}
