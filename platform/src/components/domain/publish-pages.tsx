import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AnalyzingRefresher, BatchReview, PublishForm, SplitSeriesButton, UnpublishButton } from '@/components/domain/publish'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, PageHeader } from '@/components/ui/misc'
import { arCount } from '@/lib/ar-count'
import { formatDateTime } from '@/lib/utils'
import { getDb } from '@/server/db/client'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { getBatch, listBatches, listPublished, listSeriesCandidates, PUBLISH_TYPE_AR, publishFormOptions, SECTION_OF } from '@/server/services/publish.service'

const STATUS_AR: Record<string, string> = { ANALYZING: 'قيد التحليل', READY: 'بانتظار مراجعتك', PUBLISHED: 'نُشرت', FAILED: 'فشلت' }

/** الصفحة الرئيسية لـ«نشر» (أستاذ أو مشرف): النموذج، ودفعاتي، وما نشرتُه */
export async function PublishHome({ actor, basePath, done }: { actor: Actor; basePath: string; done?: string }) {
  const db = await getDb()
  const admin = actor.role === 'SUPER_ADMIN'
  const [options, batches, published, series] = await Promise.all([publishFormOptions(db, actor), listBatches(db, actor), listPublished(db, actor), admin ? listSeriesCandidates(db, actor) : Promise.resolve([])])
  const author = admin ? actor.fullName : `الأستاذ ${actor.fullName}`.replace(/^الأستاذ (الأستاذ|الأستاذة|الدكتور|د\.)\s*/, '$1 ')
  return (
    <>
      <PageHeader title="نشر درس أو فرض أو اختبار" description="ارفع ملفاً أو مجلداً أو ZIP، واختر لمن يُنشر. الذكاء الاصطناعي يقترح التقسيم والتصنيف وتراجعه أنت قبل النشر، أو انشره كما رفعته." />
      {done ? (
        <Alert tone="success" className="mb-4">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4" /> نُشر {arCount(Number(done) || 0, ['مورد', 'موردان', 'موارد', 'مورداً'])}.{' '}
            <Link href="/exams" className="font-bold underline">
              الفروض والاختبارات
            </Link>{' '}
            ·{' '}
            <Link href="/lessons" className="font-bold underline">
              الدروس والموارد
            </Link>
          </span>
        </Alert>
      ) : null}
      {admin && series.length ? (
        <Card className="mb-6 border-accent/40">
          <CardHeader>
            <CardTitle className="text-lg">سلاسل مجمَّعة في «الدروس والموارد»</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">كل سلسلة PDF تُفكّ إلى فروض واختبارات منفصلة مع حلولها وتُضاف إلى «الفروض والاختبارات» بعد مراجعتك؛ الكتاب الكامل يبقى في «الدروس». لا يُقبل النشر إلا إذا كان لكل موضوع صفحاته ومادته وفصله.</p>
            <ul className="divide-y rounded-lg border">
              {series.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-semibold" dir="auto">
                      {s.title}
                    </span>
                    {s.published ? null : <Badge variant="muted" className="ms-2">سُحبت من الدروس</Badge>}
                  </span>
                  {s.batchId ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/publish/${s.batchId}`}>فتح المراجعة</Link>
                    </Button>
                  ) : (
                    <SplitSeriesButton contentId={s.id} />
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      <Card className="mb-6">
        <CardContent className="p-4 sm:p-6">
          <PublishForm options={options} basePath={basePath} defaultAuthor={author} admin={admin} />
        </CardContent>
      </Card>
      {batches.length ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">دفعاتي</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {batches.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {formatDateTime(b.createdAt)} — {b.count} {b.mode === 'ai' ? 'بالذكاء الاصطناعي' : 'كما رُفعت'}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant={b.status === 'PUBLISHED' ? 'success' : b.status === 'READY' ? 'warning' : 'muted'}>{STATUS_AR[b.status] ?? b.status}</Badge>
                    {b.status !== 'PUBLISHED' ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`${basePath}/${b.id}`}>فتح</Link>
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{admin ? 'ما نُشر من هذه الصفحة' : 'ما نشرتُه'}</CardTitle>
        </CardHeader>
        <CardContent>
          {published.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا شيء بعد.</p>
          ) : (
            <ul className="divide-y text-sm">
              {published.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <Badge variant="default" className="me-1.5">
                      {PUBLISH_TYPE_AR[p.type] ?? p.type}
                    </Badge>
                    <span dir="auto">{p.title}</span>
                    <span className="ms-2 text-xs text-muted-foreground">
                      {[p.subjectName, p.levelName, p.access === 'GROUP' ? 'لأفواجي' : 'عامّ', SECTION_OF[p.type] === 'exams' ? 'الفروض والاختبارات' : 'الدروس والموارد', p.hasSolution ? 'مع الحلّ' : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <UnpublishButton id={p.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
}

/** مراجعة دفعة */
export async function BatchPage({ actor, id, basePath }: { actor: Actor; id: string; basePath: string }) {
  const db = await getDb()
  let data
  try {
    data = await getBatch(db, actor, id)
  } catch (e) {
    if (e instanceof AppError) notFound()
    throw e
  }
  const options = await publishFormOptions(db, actor)
  const b = data.batch
  return (
    <>
      <PageHeader
        title="مراجعة قبل النشر"
        description={`${STATUS_AR[b.status] ?? b.status} — ${formatDateTime(b.createdAt)} · من إنشاء: ${b.defaults.author} · ${b.defaults.audience === 'GROUPS' ? 'لأفواج محدّدة' : 'عامّ'}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={basePath}>رجوع</Link>
          </Button>
        }
      />
      {b.status === 'ANALYZING' ? (
        <AnalyzingRefresher />
      ) : b.status === 'PUBLISHED' ? (
        <Alert tone="success">نُشرت هذه الدفعة {b.publishedAt ? formatDateTime(b.publishedAt) : ''}.</Alert>
      ) : (
        <BatchReview batchId={b.id} items={b.items} options={options} basePath={basePath} note={b.note} />
      )}
    </>
  )
}
