import { AlertTriangle, BookOpenCheck, CheckCircle2, Copy, FileStack, FileWarning, ListChecks, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { inArray } from 'drizzle-orm'
import { BacBatchControls, DetailQueue, InventoryTable } from '@/components/domain/bac-bank-admin'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, Progress, StatCard } from '@/components/ui/misc'
import { aiProviderInfo } from '@/server/ai/provider'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { examDocuments } from '@/server/db/schema'
import { pendingJobOfType } from '@/server/jobs/queue'
import { bacInventory, solutionDetailJobStatus, solutionDetailQueue } from '@/server/services/bac-bank.service'

export const dynamic = 'force-dynamic'

type Q = { subject?: string; status?: string }

/** Admin → بنك البكالوريا: الإنجاز، الأعداد، التغطية سنة×مادة، السنوات الغائبة، المكرّرات، أخطاء القراءة، طابور الحلول، الجرد */
export default async function BacBankAdminPage({ searchParams }: { searchParams: Promise<Q> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const q = await searchParams
  const db = await getDb()
  const [inv, queue, detailJob, processing] = await Promise.all([bacInventory(db, actor), solutionDetailQueue(db, actor, 30), solutionDetailJobStatus(db), pendingJobOfType(db, 'EXAM_DOC_PROCESS', null)])
  const docIds = inv.cells.map((c) => c.documentId).filter((x): x is string => Boolean(x))
  const docRows = docIds.length ? await db.select({ id: examDocuments.id, title: examDocuments.title, quality: examDocuments.quality }).from(examDocuments).where(inArray(examDocuments.id, docIds)) : []
  const docs = Object.fromEntries(docRows.map((d) => [d.id, { id: d.id, title: d.title, quality: d.quality as Record<string, boolean | string | undefined> }]))
  const cells = inv.cells.filter((c) => (!q.subject || c.subjectCode === q.subject) && (!q.status || (q.status === 'none' ? !c.status : c.status === q.status)))
  const t = inv.totals
  return (
    <>
      <PageHeader title="بنك البكالوريا" description="قاعدة بيانات البكالوريا الجزائرية الكاملة: المواضيع ← القراءة ← التمارين ← الحلول المفصّلة ← التصنيف ← النشر. الذكاء الاصطناعي يبني مرة، والمنصة تقرأ من القاعدة دائماً." />
      <Card className="mb-6">
        <CardContent className="space-y-2 p-5">
          <div className="flex items-end justify-between">
            <p className="text-lg font-bold">Baccalaureate Database</p>
            <p className="text-2xl font-extrabold tabular">{inv.progress}%</p>
          </div>
          <Progress value={inv.progress} tone={inv.progress >= 80 ? 'success' : 'primary'} className="h-3" />
          <p className="text-xs text-muted-foreground">
            {t.verified + t.published} موثَّقة أو منشورة من {t.exams} موضوعاً في المكتبة · {t.registered} مسجَّلة · {t.processed} محلَّلة · {t.exercises} تمريناً ({t.classified} مصنَّفة بالدرس) · {t.detailed} حلاً مفصّلاً ({t.detailedVerified} معتمدة)
          </p>
        </CardContent>
      </Card>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Exams" value={t.exams} hint={`${t.withSolution} مع الحلّ`} icon={FileStack} />
        <StatCard label="Processed" value={t.processed} hint={`${t.pendingReview} بانتظار المراجعة`} icon={ListChecks} tone={t.pendingReview ? 'warning' : 'default'} />
        <StatCard label="Verified / Published" value={`${t.verified} / ${t.published}`} icon={BookOpenCheck} tone="success" />
        <StatCard label="Missing Solutions" value={t.missingSolutions} icon={FileWarning} tone={t.missingSolutions ? 'warning' : 'default'} />
        <StatCard label="Missing Years" value={inv.missingYears.reduce((a, m) => a + m.years.length, 0)} hint={inv.missingYears.map((m) => `${m.subjectName}: ${m.years.join('، ')}`).join(' · ') || 'لا فجوات'} icon={AlertTriangle} />
        <StatCard label="Duplicate Exams" value={t.duplicates} hint={`${inv.duplicates.length} مفاتيح مكرّرة · ${inv.pdfDuplicates.length} ملفات متطابقة`} icon={Copy} tone={t.duplicates ? 'warning' : 'default'} />
        <StatCard label="OCR Errors" value={t.scanned} hint="ملفات مصوّرة بلا نصّ" icon={AlertTriangle} tone={t.scanned ? 'destructive' : 'default'} />
        <StatCard label="Pending Review" value={t.pendingReview + queue.length} hint={`${queue.length} حلاً مفصّلاً`} icon={CheckCircle2} />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BacBatchControls inv={inv} aiConfigured={aiProviderInfo().configured} jobs={{ processing: Boolean(processing), detailing: detailJob.pending, detailProcessed: detailJob.processed, detailTotal: detailJob.total, lastError: detailJob.lastError }} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">التغطية: المادة × السنة</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto p-0">
            {inv.coverage.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                المكتبة فارغة — ابدأ من{' '}
                <Link href="/admin/curriculum" className="underline">
                  المنهاج والمكتبة ← جلب DzExams
                </Link>
                .
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="p-1.5 text-start">المادة</th>
                    {inv.years.slice(0, 12).map((y) => (
                      <th key={y} className="p-1.5 tabular">
                        {y}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inv.coverage.map((c) => (
                    <tr key={c.subjectCode} className="border-b">
                      <td className="p-1.5">
                        <Link href={`/admin/bac-bank?subject=${c.subjectCode}`} className="hover:underline">
                          {c.subjectName}
                        </Link>
                      </td>
                      {inv.years.slice(0, 12).map((y) => (
                        <td key={y} className="p-1.5 text-center">
                          {c.years[y] ? <Badge variant="success">{c.years[y]}</Badge> : <span className="text-destructive">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
      {inv.ocrErrors.length ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Admin Review Queue — ملفات مصوّرة (تحتاج OCR أو نسخة نصّية)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 ps-6 text-sm">
              {inv.ocrErrors.slice(0, 30).map((e) => (
                <li key={e.id}>
                  {e.title} <span className="text-xs text-muted-foreground">{e.error}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-5 text-accent" /> الحلول المفصّلة بانتظار المراجعة <Badge variant="muted">{queue.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DetailQueue items={queue} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            الجرد: سنة × شعبة × مادة × موضوع
            <span className="flex flex-wrap gap-1 text-xs font-normal">
              <Link href="/admin/bac-bank" className="rounded-full border px-2 py-0.5">
                الكل
              </Link>
              {['none', 'PENDING', 'NEEDS_REVIEW', 'VERIFIED', 'PUBLISHED', 'FAILED'].map((s) => (
                <Link key={s} href={`/admin/bac-bank?status=${s}${q.subject ? `&subject=${q.subject}` : ''}`} className={`rounded-full border px-2 py-0.5 ${q.status === s ? 'border-primary bg-primary text-primary-foreground' : ''}`}>
                  {s === 'none' ? 'غير مسجَّل' : s === 'PENDING' ? 'معلّق' : s === 'NEEDS_REVIEW' ? 'للمراجعة' : s === 'VERIFIED' ? 'موثَّق' : s === 'PUBLISHED' ? 'منشور' : 'فشل'}
                </Link>
              ))}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">{cells.length === 0 ? <p className="p-4 text-sm text-muted-foreground">لا صفوف.</p> : <InventoryTable cells={cells.slice(0, 500)} docs={docs} />}</CardContent>
      </Card>
    </>
  )
}
