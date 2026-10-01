import { ArrowRight, Copy, FileText, History, Printer } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { getDictionary } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { examHistory, getOwnExam } from '@/server/services/exams.service'

export const dynamic = 'force-dynamic'

function label(action: string): string {
  const labels = getDictionary().activity as Record<string, string | undefined>
  return labels[action.replace(/\./g, '_')] ?? action
}

/** تفاصيل الحدث بالعربية: الطباعة (موضوع/تصحيح، نسخة)، القالب، المصدر… */
function detail(action: string, v: Record<string, unknown> | null): string | null {
  if (!v) return null
  if (action === 'exam.print') return `${v.mode === 'correction' ? 'التصحيح والسلّم' : 'الموضوع'}${v.variant && v.variant !== 'A' ? ` — النسخة ${String(v.variant)}` : ''}`
  if (action === 'exam.auto_build') return `${Number(v.picked ?? 0)} من البنك${Number(v.missing ?? 0) ? `، ${Number(v.missing)} ناقص` : ''}`
  if (action === 'exam.template') return v.isTemplate ? 'أصبح قالباً' : 'لم يعد قالباً'
  if (action === 'exam.update') {
    const names: Record<string, string> = { title: 'العنوان', kind: 'النوع', subjectId: 'المادة', levelId: 'الصف', streamId: 'الشعبة', schoolTerm: 'الفصل', durationMinutes: 'المدة', targetPoints: 'المجموع', instructions: 'التعليمات', status: 'الحالة', groupId: 'الفوج', isTemplate: 'القالب', academicYear: 'السنة', header: 'الترويسة' }
    const named = Object.keys(v).filter((k) => v[k] !== undefined).map((k) => names[k]).filter(Boolean)
    if (v.status === 'READY') return `أصبح جاهزاً${named.length > 1 ? ` · ${named.filter((n) => n !== 'الحالة').join('، ')}` : ''}`
    if (v.status === 'ARCHIVED') return 'أُرشف'
    return named.length ? named.join('، ') : 'بلا تغيير'
  }
  if (action === 'exam.rebalance') return v.total != null ? `المجموع ${Number(v.total)}` : null
  return null
}

export default async function ExamHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  const db = await getDb()
  let exam
  try {
    exam = await getOwnExam(db, actor, id)
  } catch (e) {
    if (e instanceof AppError) notFound()
    throw e
  }
  const h = await examHistory(db, actor, id)
  const prints = h.events.filter((e) => e.action === 'exam.print').length
  return (
    <>
      <PageHeader
        title={`سجلّ: ${exam.title}`}
        description={`${h.events.length} حدثاً · ${prints} طباعة · ${h.copies.length} نسخة مشتقّة`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/teacher/exams/${id}`}>
              <ArrowRight className="size-4" /> العودة إلى المحرّر
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="size-4" /> الأحداث
            </CardTitle>
          </CardHeader>
          <CardContent>
            {h.events.length === 0 ? (
              <EmptyState icon={History} title="لا أحداث بعد" />
            ) : (
              <ol className="relative border-s ps-4">
                {h.events.map((e) => (
                  <li key={e.id} className="relative pb-4 last:pb-0">
                    <span className={`absolute -start-[21px] top-1.5 size-2.5 rounded-full ${e.action === 'exam.print' ? 'bg-success' : 'bg-primary/60'}`} />
                    <p className="text-sm font-semibold">
                      {e.action === 'exam.print' ? <Printer className="me-1 inline size-3.5" /> : null}
                      {label(e.action)}
                      {detail(e.action, e.newValue) ? <span className="ms-2 font-normal text-muted-foreground">({detail(e.action, e.newValue)})</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(e.createdAt)}
                      {e.actorName ? ` · ${e.actorName}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
        <div className="space-y-6">
          {h.source ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">الأصل</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <Link href={`/teacher/exams/${h.source.id}`} className="font-semibold hover:underline">
                  {h.source.title}
                </Link>
                <p className="text-xs text-muted-foreground">نُسخ هذا الامتحان أو أُنشئ من قالب.</p>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Copy className="size-4" /> النسخ المشتقّة
              </CardTitle>
            </CardHeader>
            <CardContent>
              {h.copies.length === 0 ? (
                <p className="text-sm text-muted-foreground">لم يُنسخ بعد.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {h.copies.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                      <Link href={`/teacher/exams/${c.id}`} className="min-w-0 truncate font-semibold hover:underline">
                        <FileText className="me-1 inline size-3.5" />
                        {c.title}
                      </Link>
                      {c.status === 'READY' ? <Badge variant="success">جاهز</Badge> : c.status === 'ARCHIVED' ? <Badge variant="muted">مؤرشف</Badge> : <Badge variant="secondary">مسودة</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
