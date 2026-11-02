import { PackageCheck, Store, Wallet } from 'lucide-react'
import Link from 'next/link'
import { asc } from 'drizzle-orm'
import { PosForm } from '@/components/pos/pos-admin'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader, StatCard } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { wilayas } from '@/server/db/schema'
import { listPointsOfSale } from '@/server/services/points-of-sale.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'نقاط البيع' }

/** نقاط البيع (المدارس والمكتبات الشريكة): المشرف ومدير العمليات */
export default async function PointsOfSalePage() {
  const actor = await requirePageActor('SUPER_ADMIN', 'MANAGER')
  const db = await getDb()
  const [items, ws] = await Promise.all([listPointsOfSale(db, actor), db.select({ id: wilayas.id, code: wilayas.code, name: wilayas.nameAr }).from(wilayas).orderBy(asc(wilayas.code))])
  const totals = items.reduce((a, p) => ({ remaining: a.remaining + p.remaining, sold: a.sold + p.soldCount, owed: a.owed + p.owedDzd }), { remaining: 0, sold: 0, owed: 0 })
  return (
    <div className="space-y-6">
      <PageHeader title="نقاط البيع" description="المدارس والمكتبات الشريكة: تستلم الباقات، وتولّد كود التفعيل لحظة البيع، وتدفع بعد البيع." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="باقات عند النقاط" value={totals.remaining} icon={PackageCheck} />
        <StatCard label="باقات بيعت" value={totals.sold} icon={Store} tone="success" />
        <StatCard label="المستحق على النقاط" value={`${totals.owed} دج`} icon={Wallet} tone={totals.owed > 0 ? 'warning' : 'default'} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>كل النقاط</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState icon={Store} title="لا نقاط بيع بعد" description="أضف أول مدرسة أو مكتبة من النموذج أدناه." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>النقطة</TableHead>
                    <TableHead>الولاية</TableHead>
                    <TableHead>الحسابات</TableHead>
                    <TableHead>باقي عندها</TableHead>
                    <TableHead>بيعت</TableHead>
                    <TableHead>المستحق</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link href={`/admin/points-of-sale/${p.id}`} className="font-semibold text-primary hover:underline">
                          {p.name}
                        </Link>
                        {p.phone ? (
                          <span className="block text-xs text-muted-foreground" dir="ltr">
                            {p.phone}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">{p.wilayaName ?? '—'}</TableCell>
                      <TableCell className="tabular-nums">{p.members}</TableCell>
                      <TableCell className={`tabular-nums font-bold ${p.remaining <= 0 ? 'text-destructive' : ''}`}>{p.remaining}</TableCell>
                      <TableCell className="tabular-nums">{p.soldCount}</TableCell>
                      <TableCell className="tabular-nums">{p.owedDzd} دج</TableCell>
                      <TableCell>{p.status === 'ACTIVE' ? <Badge variant="success">مفتوحة</Badge> : <Badge variant="muted">مغلقة</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>نقطة بيع جديدة</CardTitle>
          <CardDescription>بعد الإضافة: ولّد حسابها وأرسله لها عبر واتساب، ثم سجّل الباقات المرسَلة.</CardDescription>
        </CardHeader>
        <CardContent>
          <PosForm wilayas={ws.map((w) => ({ id: w.id, name: `${w.code} — ${w.name}` }))} isAdmin={actor.role === 'SUPER_ADMIN'} />
        </CardContent>
      </Card>
    </div>
  )
}
