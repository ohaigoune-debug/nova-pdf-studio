import Link from 'next/link'
import { AdPixelsForm } from '@/components/landing/ad-pixels-form'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { loadAdPixels } from '@/server/services/ad-pixels.service'
import { landingStats, listLandings } from '@/server/services/landing.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'صفحات الهبوط' }

/** كل صفحات الهبوط ونتائجها؛ الإنشاء من صفحة الدورة بزر «إنشاء صفحة هبوط» */
export default async function AdminLandingListPage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const db = await getDb()
  const rows = await listLandings(db, actor)
  const [stats, pixels] = await Promise.all([landingStats(db, actor, rows.map((r) => r.id)), loadAdPixels(db)])
  return (
    <div className="space-y-6">
      <PageHeader title="صفحات الهبوط" description="صفحة عامة لكل دورة لجلب التلاميذ من الترويج. أنشئ صفحة من صفحة الدورة: «الدورات والدروس» ← الدورة ← «إنشاء صفحة هبوط»." />
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الصفحة</TableHead>
              <TableHead>الدورة</TableHead>
              <TableHead>الزوار</TableHead>
              <TableHead>الطلبات</TableHead>
              <TableHead>المسلَّم</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const s = stats.get(r.id) ?? []
              const sum = (k: 'visits' | 'orders' | 'delivered') => s.reduce((t, x) => t + x[k], 0)
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/admin/landing/${r.id}`} className="font-mono font-semibold hover:underline" dir="ltr">
                      /go/{r.slug}
                    </Link>
                    <Badge variant={r.active ? 'success' : 'muted'} className="ms-2">
                      {r.active ? 'مشغّلة' : 'متوقفة'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{r.courseTitle}</TableCell>
                  <TableCell className="tabular-nums">{sum('visits')}</TableCell>
                  <TableCell className="tabular-nums">{sum('orders')}</TableCell>
                  <TableCell className="tabular-nums">{sum('delivered')}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      ) : (
        <EmptyState title="لا صفحات هبوط بعد" description="افتح دورة من «الدورات والدروس» واضغط «إنشاء صفحة هبوط»." />
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">بكسل الإعلانات الممولة</CardTitle>
          <p className="text-sm text-muted-foreground">
            للحملات الممولة على فيسبوك وإنستغرام وتيك توك: يعدّ البكسل زيارة الصفحة، والضغط على «اطلب الآن»، والطلب نفسه (برقمه ومبلغه، دون اسم أو هاتف)، فتتعلّم المنصة الإعلانية من يطلب فعلًا. فارغ = معطّل.
            {pixels.meta || pixels.tiktok ? ` مفعّل الآن: ${[pixels.meta ? 'Meta' : '', pixels.tiktok ? 'TikTok' : ''].filter(Boolean).join(' و')}.` : ''}
          </p>
        </CardHeader>
        <CardContent>
          <AdPixelsForm meta={pixels.meta} tiktok={pixels.tiktok} />
        </CardContent>
      </Card>
    </div>
  )
}
