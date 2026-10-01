import { ArrowRight, BarChart3, BookTemplate, FileText, Library, Printer } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, Progress, StatCard } from '@/components/ui/misc'
import { DIFF_AR } from '@/lib/bank-labels'
import { formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import type { ExamKind } from '@/server/db/schema/enums'
import { EXAM_KIND_AR, workspaceStats } from '@/server/services/exams.service'
import { bankStats } from '@/server/services/question-bank.service'

export const dynamic = 'force-dynamic'

const MONTHS_AR = ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-')
  return `${MONTHS_AR[Number(m) - 1] ?? m} ${y}`
}

function Bars({ rows, total }: { rows: { label: string; n: number; tone?: 'primary' | 'success' | 'warning' | 'destructive' }[]; total: number }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">لا بيانات بعد.</p>
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-center justify-between">
            <span>{r.label}</span>
            <span className="tabular text-xs text-muted-foreground">
              {r.n}
              {total ? ` · ${Math.round((r.n / total) * 100)}%` : ''}
            </span>
          </div>
          <Progress value={total ? (r.n / total) * 100 : 0} tone={r.tone ?? 'primary'} />
        </li>
      ))}
    </ul>
  )
}

/** إحصاءات الورشة (المرحلة 6): ما يُنتجه الأستاذ، وبأي صعوبة، وما يُطبع، وما يُستعمل من البنك */
export default async function ExamStatsPage() {
  const actor = await requirePageActor('TEACHER')
  const db = await getDb()
  const [s, bank] = await Promise.all([workspaceStats(db, actor), bankStats(db, actor)])
  const diffTotal = Object.values(s.difficulty).reduce((a, b) => a + b, 0)
  const kindTotal = s.byKind.reduce((a, b) => a + b.n, 0)
  const subjTotal = s.bySubject.reduce((a, b) => a + b.n, 0)
  const printMax = Math.max(1, ...s.printsByMonth.map((m) => m.n))
  const tones: Record<number, 'success' | 'primary' | 'warning' | 'destructive'> = { 1: 'success', 2: 'primary', 3: 'warning', 4: 'destructive' }
  return (
    <>
      <PageHeader
        title="إحصاءات الورشة"
        description="نظرة على إنتاجك: الامتحانات، الصعوبة، الطباعة، وما يُستعمل من بنكك."
        actions={
          <Button asChild variant="outline">
            <Link href="/teacher/exams">
              <ArrowRight className="size-4" /> الورشة
            </Link>
          </Button>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="الامتحانات" value={s.exams.total} hint={`${s.exams.ready} جاهز · ${s.exams.draft} مسودة · ${s.exams.archived} مؤرشف`} icon={FileText} />
        <StatCard label="القوالب" value={s.exams.templates} icon={BookTemplate} />
        <StatCard label="الطباعات" value={s.prints.total} hint={`${s.prints.month} هذا الشهر`} icon={Printer} tone="success" />
        <StatCard label="بنكي" value={bank.mine} hint={`${bank.review} في المراجعة · ${bank.favorites} مفضّلة`} icon={Library} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4" /> حسب المادة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Bars rows={s.bySubject.map((r) => ({ label: r.name, n: r.n }))} total={subjTotal} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">حسب النوع</CardTitle>
          </CardHeader>
          <CardContent>
            <Bars rows={s.byKind.map((r) => ({ label: EXAM_KIND_AR[r.kind as ExamKind] ?? r.kind, n: r.n }))} total={kindTotal} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">صعوبة ما في أوراقك</CardTitle>
          </CardHeader>
          <CardContent>
            <Bars rows={[1, 2, 3, 4].filter((d) => s.difficulty[d]).map((d) => ({ label: DIFF_AR[d]?.label ?? String(d), n: s.difficulty[d]!, tone: tones[d] }))} total={diffTotal} />
            <p className="mt-2 text-xs text-muted-foreground">يُحسب من عناصر الامتحانات غير المؤرشفة. توزيع متوازن قريب من 30 / 50 / 20.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Printer className="size-4" /> الطباعة في آخر 6 أشهر
            </CardTitle>
          </CardHeader>
          <CardContent>
            {s.printsByMonth.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا طباعات مسجّلة بعد. تُسجَّل عند الضغط على «طباعة / حفظ PDF».</p>
            ) : (
              <ul className="flex h-32 items-end gap-2" aria-label="الطباعات شهرياً">
                {s.printsByMonth.map((m) => (
                  <li key={m.month} className="flex min-w-0 flex-1 flex-col items-center gap-1 text-[11px]">
                    <span className="tabular">{m.n}</span>
                    <div className="w-full rounded-t bg-primary/70" style={{ height: `${Math.max(6, (m.n / printMax) * 88)}px` }} title={`${monthLabel(m.month)}: ${m.n}`} />
                    <span className="truncate text-muted-foreground">{monthLabel(m.month)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">الأسئلة الأكثر استعمالاً من بنكك</CardTitle>
          </CardHeader>
          <CardContent>
            {s.topQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">لم يُستعمل شيء من البنك في امتحان بعد.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {s.topQuestions.map((q, i) => (
                  <li key={q.id} className="flex items-start gap-2">
                    <span className="tabular text-muted-foreground">{i + 1}.</span>
                    <Link href={`/teacher/bank/${q.id}`} className="min-w-0 flex-1 hover:underline" dir="auto">
                      {q.title ? <strong>{q.title} — </strong> : null}
                      <span className="line-clamp-1">{q.body}</span>
                    </Link>
                    <Badge variant="muted">{q.usageCount} مرة</Badge>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">الأخيرة</CardTitle>
          </CardHeader>
          <CardContent>
            {s.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا امتحانات بعد.</p>
            ) : (
              <ul className="divide-y text-sm">
                {s.recent.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                    <Link href={`/teacher/exams/${r.id}`} className="min-w-0 truncate font-semibold hover:underline">
                      {r.title}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(r.updatedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
