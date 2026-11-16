import { Shuffle } from 'lucide-react'
import { ScopeRequestDecision } from '@/components/student/scope-request-decision'
import { Badge } from '@/components/ui/badge'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listScopeRequests } from '@/server/services/student-scope.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'طلبات تغيير الشعبة' }

/**
 * /admin/scope-requests — طلبات التلاميذ لتغيير المستوى/الشعبة (قرار المالك 16 نوفمبر 2026).
 * عون التأكيد (أو المشرف) يتصل بالتلميذ إن لزم، ثم يؤكّد (يُطبَّق على حسابه فورًا) أو يرفض بسبب.
 */
export default async function ScopeRequestsPage() {
  const actor = await requirePageActor('SUPER_ADMIN', 'CONFIRMER')
  const db = await getDb()
  const [pending, decided] = await Promise.all([listScopeRequests(db, actor, 'PENDING'), listScopeRequests(db, actor, 'DECIDED')])
  return (
    <div className="space-y-8">
      <PageHeader title="طلبات تغيير الشعبة" description="التلميذ لا يغيّر مستواه أو شعبته بنفسه بعد أول اختيار. راجع الطلب (واتصل به إن لزم) ثم أكّده أو ارفضه بسبب؛ يصله إشعار بالقرار، وتتغيّر دروسه في «دروسي» فور التأكيد." />
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">
          بانتظار المراجعة <span className="text-sm font-normal text-muted-foreground">({pending.length})</span>
        </h2>
        {pending.length === 0 ? (
          <EmptyState icon={Shuffle} title="لا طلبات معلّقة" />
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التلميذ</TableHead>
                  <TableHead>الهاتف</TableHead>
                  <TableHead>من</TableHead>
                  <TableHead>إلى</TableHead>
                  <TableHead>السبب</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>القرار</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((r) => (
                  <TableRow key={r.id} data-testid="scope-request-row">
                    <TableCell className="font-semibold">{r.studentName}</TableCell>
                    <TableCell dir="ltr" className="whitespace-nowrap text-right">
                      {r.phone ? <a href={`tel:${r.phone}`} className="text-primary hover:underline">{r.phone}</a> : '—'}
                    </TableCell>
                    <TableCell className="text-sm">{r.fromLabel ?? '—'}</TableCell>
                    <TableCell className="text-sm font-semibold">{r.toLabel}</TableCell>
                    <TableCell className="max-w-56 text-sm text-muted-foreground">{r.reason ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{formatDateTime(r.createdAt)}</TableCell>
                    <TableCell>
                      <ScopeRequestDecision id={r.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
      {decided.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">آخر القرارات</h2>
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {decided.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 p-3">
                {r.status === 'APPROVED' ? <Badge variant="success">أُكّد</Badge> : <Badge variant="destructive">رُفض</Badge>}
                <span className="font-semibold">{r.studentName}</span>
                <span className="text-muted-foreground">
                  {r.fromLabel ?? '—'} ← {r.toLabel}
                </span>
                {r.decisionNote ? <span className="text-muted-foreground">— {r.decisionNote}</span> : null}
                <span className="ms-auto text-xs text-muted-foreground">
                  {r.decidedBy ?? '—'} · {formatDateTime(r.decidedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
