import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState, PageHeader, StatCard } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { COD_SOURCE_AR, EXCUSE_WINDOW_DAYS, codBlockCounts, listCodBlocks } from '@/server/services/cod-blocks.service'
import { BlockPhoneForm, LiftPhoneButton } from './forms'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'ممنوعون من الدفع عند الاستلام' }

/**
 * /admin/store/cod-blocks — من أرجع طلبًا بلا سبب يطلب بالبطاقة فقط (قرار المالك 17 نوفمبر 2026).
 * القائمة: المستوردة من نوفا، واليدوية، ومرتجعات مدرسة بلا سبب (تُحسب من الطلبات تلقائيًا).
 */
export default async function CodBlocksPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const { q } = await searchParams
  const db = await getDb()
  const [{ rows, total, lifted }, counts] = await Promise.all([listCodBlocks(db, actor, { q }), codBlockCounts(db)])
  const madrasa = rows.filter((r) => r.source === 'MADRASA').length
  return (
    <div className="space-y-6">
      <PageHeader
        title="ممنوعون من الدفع عند الاستلام"
        description={`من أرجع طلبًا دون سبب ولو مرة واحدة يطلب بالبطاقة فقط (الذهبية أو CIB). الإرجاع معذور إذا كان لصاحبه طلب آخر سُلِّم خلال ${EXCUSE_WINDOW_DAYS} أيام منه. يُفحص هاتف الطلب وهاتف الحساب معًا.`}
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="من متجر نوفا" value={counts.NOVA} />
        <StatCard label="مرتجعات مدرسة" value={madrasa} />
        <StatCard label="أضفتها يدويًا" value={counts.ADMIN} />
        <StatCard label="أُعفوا" value={lifted} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">منع رقم يدويًا</CardTitle>
        </CardHeader>
        <CardContent>
          <BlockPhoneForm />
        </CardContent>
      </Card>

      <form className="flex gap-2" role="search">
        <Input name="q" defaultValue={q ?? ''} placeholder="ابحث برقم الهاتف" dir="ltr" inputMode="tel" className="max-w-xs" aria-label="ابحث برقم الهاتف" />
        <Button type="submit" variant="outline">بحث</Button>
      </form>

      {rows.length ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {q ? `نتائج «${q}»: ${total}` : `المجموع: ${total} رقمًا`}
            {total > rows.length ? ` — يظهر أحدث ${rows.length}` : ''}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الهاتف</TableHead>
                <TableHead>السبب</TableHead>
                <TableHead>المرتجعات</TableHead>
                <TableHead>آخر إرجاع</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.phone}>
                  <TableCell dir="ltr" className="font-mono tabular-nums">{r.phone}</TableCell>
                  <TableCell>
                    <Badge variant={r.source === 'MADRASA' ? 'warning' : 'secondary'}>{COD_SOURCE_AR[r.source]}</Badge>
                    {r.note ? <span className="ms-2 text-xs text-muted-foreground">{r.note}</span> : null}
                  </TableCell>
                  <TableCell className="tabular-nums">{r.returns || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.lastReturnAt ? formatDate(r.lastReturnAt) : '—'}</TableCell>
                  <TableCell>
                    <LiftPhoneButton phone={r.phone} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState title={q ? 'لا رقم ممنوعًا بهذا البحث' : 'لا أرقام ممنوعة بعد'} description={q ? 'هذا الرقم يستطيع الطلب بالدفع عند الاستلام.' : 'استورد قائمة نوفا من الخادم، أو أضف رقمًا يدويًا.'} />
      )}
    </div>
  )
}
