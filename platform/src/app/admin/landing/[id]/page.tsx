import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CopyLink, LandingEditor } from '@/components/landing/landing-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { SHARE_SOURCES, SUGGESTED_FAQ, landingById, landingStats, sourceLabel } from '@/server/services/landing.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'صفحة هبوط' }

const base = () => (process.env.APP_URL || 'https://madrasadz.com').replace(/\/+$/, '')

/** محرّر صفحة هبوط: الإعداد، وروابط المصادر، والنتائج (زوار → طلبات → مسلَّم) */
export default async function AdminLandingPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const db = await getDb()
  const landing = await landingById(db, actor, id)
  if (!landing) notFound()
  const stats = (await landingStats(db, actor, [landing.id])).get(landing.id) ?? []
  const url = `${base()}/go/${landing.slug}`
  const totals = stats.reduce((t, s) => ({ visits: t.visits + s.visits, orders: t.orders + s.orders, delivered: t.delivered + s.delivered }), { visits: 0, orders: 0, delivered: 0 })
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={`صفحة الهبوط: ${landing.slug}`}
        description="العنوان والسعر والعرضان والتوصيل تأتي من الدورة نفسها. الطلبات تصل إلى «الطلبات» كالعادة، وعليها اسم هذه الصفحة ومصدرها."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/go/${landing.slug}?preview=1`} target="_blank">
                <ExternalLink className="size-4" aria-hidden /> معاينة
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/admin/courses/${landing.courseId}`}>الدورة</Link>
            </Button>
          </div>
        }
      />
      <Badge variant={landing.active ? 'success' : 'muted'}>{landing.active ? 'مشغّلة' : 'متوقفة'}</Badge>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">روابط النشر</CardTitle>
          <CardDescription>ضع لكل منصة رابطها، فتعرف من أين جاء كل تلميذ.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-lg border text-sm">
            {SHARE_SOURCES.map((s) => {
              const link = `${url}?src=${s}`
              return (
                <li key={s} className="flex items-center justify-between gap-2 p-2.5">
                  <span className="min-w-0">
                    <span className="block font-semibold">{sourceLabel(s)}</span>
                    <span className="block truncate text-xs text-muted-foreground" dir="ltr">{link}</span>
                  </span>
                  <CopyLink url={link} />
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground" dir="rtl">
            لمسوّق أو مدرسة: أضف <span dir="ltr" className="font-mono">?src=اسم-قصير</span> باللاتينية، مثل <span dir="ltr" className="font-mono">?src=ecole-bousaada</span>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">النتائج</CardTitle>
          <CardDescription>
            {totals.visits} زائر · {totals.orders} طلب · {totals.delivered} مسلَّم
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المصدر</TableHead>
                  <TableHead>الزوار</TableHead>
                  <TableHead>الطلبات</TableHead>
                  <TableHead>المسلَّم</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((s) => (
                  <TableRow key={s.source}>
                    <TableCell className="font-semibold">{s.label}</TableCell>
                    <TableCell className="tabular-nums">{s.visits}</TableCell>
                    <TableCell className="tabular-nums">{s.orders}</TableCell>
                    <TableCell className="tabular-nums">{s.delivered}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">لا زيارات بعد. شغّل الصفحة وانشر روابطها.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">محتوى الصفحة</CardTitle>
        </CardHeader>
        <CardContent>
          <LandingEditor
            value={{ id: landing.id, slug: landing.slug, headline: landing.headline, subheadline: landing.subheadline, videoUrl: landing.videoUrl, bullets: landing.bullets, about: landing.about, faq: landing.faq, active: landing.active }}
            suggestedFaq={SUGGESTED_FAQ}
          />
        </CardContent>
      </Card>
    </div>
  )
}
