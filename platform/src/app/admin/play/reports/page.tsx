import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { REASON_AR, REPORT_STATUS_AR } from '@/components/play-admin/labels'
import { ReportActions } from '@/components/play-admin/report-actions'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn, formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { PLAY_REPORT_STATUSES, type PlayReportStatus } from '@/server/play/constants'
import { listReportsDetailed } from '@/server/services/play-admin.service'

export const dynamic = 'force-dynamic'

/** Admin → PLAY → بلاغات التلاميذ: مفتوحة / مُعالَجة / مرفوضة */
export default async function PlayReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const { tab } = await searchParams
  const status: PlayReportStatus = (PLAY_REPORT_STATUSES as readonly string[]).includes(tab ?? '') ? (tab as PlayReportStatus) : 'OPEN'
  const db = await getDb()
  const [rows, openCount] = await Promise.all([listReportsDetailed(db, actor, status, 200), status === 'OPEN' ? null : listReportsDetailed(db, actor, 'OPEN', 1000).then((r) => r.length)])
  const open = status === 'OPEN' ? rows.length : openCount ?? 0

  return (
    <>
      <PageHeader title="بلاغات PLAY" description="ما يرفعه التلاميذ أثناء اللعب عن سؤال خاطئ أو غامض. عالج البلاغ بعد تصحيح السؤال أو تعليقه، أو ارفضه إن كان غير مبرَّر." />
      <div className="mb-4 flex flex-wrap gap-2">
        {PLAY_REPORT_STATUSES.map((s) => (
          <Link key={s} href={`/admin/play/reports?tab=${s}`} className={cn('rounded-full border px-3 py-1 text-sm', status === s ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')}>
            {REPORT_STATUS_AR[s]}
            {s === 'OPEN' ? <span className="ms-1 tabular">({open})</span> : null}
          </Link>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">لا بلاغات في هذا التبويب.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>السؤال</TableHead>
                  <TableHead>التلميذ</TableHead>
                  <TableHead>السبب</TableHead>
                  <TableHead>الرسالة</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead className="text-end">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-[300px]">
                      <Link href={`/admin/play/questions/${r.questionId}`} className="flex items-center gap-1 font-mono text-xs text-primary hover:underline" dir="ltr">
                        {r.key} <ExternalLink className="size-3" />
                      </Link>
                      <p className="truncate text-sm" title={r.questionText}>
                        {r.questionText}
                      </p>
                      {r.isSuspended ? <Badge variant="destructive">معلَّق</Badge> : null}
                    </TableCell>
                    <TableCell className="text-sm">{r.studentName ?? (r.studentId ? <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.studentId.slice(0, 8)}…</span> : <span className="text-muted-foreground">—</span>)}</TableCell>
                    <TableCell className="text-sm">{(REASON_AR as Record<string, string>)[r.reason] ?? r.reason}</TableCell>
                    <TableCell className="max-w-[260px] text-sm text-muted-foreground">
                      <p className="line-clamp-3">{r.message || '—'}</p>
                      {r.resolution ? <p className="mt-1 text-xs">القرار: {r.resolution}</p> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(r.createdAt)}
                      {r.resolvedAt ? <p>عولج: {formatDateTime(r.resolvedAt)}</p> : null}
                    </TableCell>
                    <TableCell className="text-end">{r.status === 'OPEN' ? <ReportActions id={r.id} /> : <Badge variant="muted">{(REPORT_STATUS_AR as Record<string, string>)[r.status] ?? r.status}</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
