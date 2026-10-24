import { MyOrdersTracking } from '@/components/domain/order-tracking'
import { myTrackedOrders } from '@/server/services/order-tracking.service'
import { HubTabs } from '@/components/student/hub-tabs'
import { BookMarked, Clock, FileText, PlayCircle, Radio, ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { myCourses } from '@/server/services/courses.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'دوراتي' }

export default async function StudentCoursesPage() {
  const actor = await requirePageActor('STUDENT')
  const db = await getDb()
  const [courses, orders] = await Promise.all([myCourses(db, actor), myTrackedOrders(db, actor)])
  const items = courses.sort((a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE'))
  const pendingOrders = orders.filter((o) => !['DELIVERED', 'RETURNED', 'CANCELLED'].includes(o.status))
  return (
    <>
      <HubTabs hub="courses" />
      <PageHeader
        title="دوراتي"
        description="الدورات التي اشتركت فيها: حصص مباشرة، فيديوهات مسجّلة، ملفات، وقسم افتراضي مع أستاذك."
      />
      <div className="mb-6 flex flex-wrap gap-3">
        <Button asChild><Link href="/student/courses/catalog">اكتشف الدورات المتاحة</Link></Button>
        <Button asChild variant="outline"><Link href="/student/courses/orders"><ShoppingBag className="size-4" /> طلباتي وحالة التوصيل</Link></Button>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title="لا اشتراك في أي دورة بعد"
          description="يُفعَّل اشتراكك تلقائياً عند استلام الكتاب الذي اشتريته من المتجر، أو عبر رمز التفعيل الذي تتلقّاه بالرسالة."
          action={
            <span className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/student/courses/catalog">
                  <BookMarked className="size-4" /> تصفّح كتالوج الدورات
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/store">
                  <ShoppingBag className="size-4" /> المتجر
                </Link>
              </Button>
            </span>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((c) => {
            const expired = c.status !== 'ACTIVE'
            return (
              <Card key={c.id} className={cn('overflow-hidden', expired && 'opacity-70 grayscale')}>
                {c.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.coverUrl} alt="" className="aspect-[16/7] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[16/7] w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                    <BookMarked className="size-10" />
                  </div>
                )}
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold leading-snug">{c.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {c.teacherName} · {c.season}
                      </p>
                    </div>
                    {expired ? <Badge variant="muted">انتهى</Badge> : <Badge variant="success">نشط</Badge>}
                  </div>

                  {!expired && c.nextLive ? (
                    <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 p-2.5 text-sm">
                      <Radio className="size-4 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block font-semibold">البث القادم: {c.nextLive.title}</span>
                        <span className="block text-xs text-muted-foreground">{formatDateTime(c.nextLive.startsAt)}</span>
                      </span>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <PlayCircle className="size-3.5" /> {c.videos} فيديو
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FileText className="size-3.5" /> {c.lessons} درس/ملف
                    </span>
                    {c.expiresAt || c.accessEndsOn ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" /> {expired ? 'انتهى في' : 'حتى'} {formatDate(c.expiresAt ?? c.accessEndsOn)}
                      </span>
                    ) : null}
                  </div>

                  {expired ? (
                    <p className="text-xs text-muted-foreground">انتهت مدة الوصول إلى محتوى هذه الدورة. للتجديد تواصل مع الإدارة.</p>
                  ) : (
                    <Button asChild className="w-full" variant={c.termsAccepted ? 'default' : 'outline'}>
                      <Link href={c.href}>{c.termsAccepted ? 'دخول الدورة' : 'اقرأ الشروط وادخل'}</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
      {pendingOrders.length ? (
        <section className="mt-6 space-y-3">
          <h2 className="text-xl font-bold">بانتظار التفعيل</h2>
          <p className="text-sm text-muted-foreground">تُفعَّل الدورة المرتبطة بالكتاب بعد تأكيد التسليم من شركة التوصيل.</p>
          <MyOrdersTracking orders={pendingOrders.map((o) => ({ ...o, createdAt: o.createdAt.toISOString(), timeline: o.timeline.map((t) => ({ ...t, at: t.at.toISOString() })) }))} />
        </section>
      ) : null}
    </>
  )
}
