import { MyOrdersTracking } from '@/components/domain/order-tracking'
import { myTrackedOrders } from '@/server/services/order-tracking.service'
import { BookMarked, Clock, KeyRound, ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/misc'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { myCourses } from '@/server/services/courses.service'
import { studentToday } from '@/server/services/student-today.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'دوراتي' }

/**
 * «دوراتي» (التصوّر المعتمد، 21 نوفمبر 2026): الدورات المفعّلة وحدها، بغلاف كبير مربّع وتقدّم التلميذ وموعد
 * حصته المباشرة القادمة؛ البطاقة كلها تفتح الدورة. تحتها «أضف دورة جديدة»: تفعيل بالكود أو الكتب والدورات.
 */
export default async function StudentCoursesPage() {
  const actor = await requirePageActor('STUDENT')
  const db = await getDb()
  const [courses, orders, today] = await Promise.all([myCourses(db, actor), myTrackedOrders(db, actor), studentToday(db, actor, new Date())])
  const items = courses.sort((a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE'))
  const progress = new Map(today.courses.map((c) => [c.id, c]))
  const pendingOrders = orders.filter((o) => !['DELIVERED', 'RETURNED', 'CANCELLED'].includes(o.status))
  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">دوراتي</h1>
        <p className="text-sm text-muted-foreground">الدورات المفعّلة في حسابك فقط</p>
      </header>

      {items.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => {
            const expired = c.status !== 'ACTIVE'
            const p = progress.get(c.id)
            const pct = p && p.total ? Math.round((p.seen / p.total) * 100) : 0
            const body = (
              <>
                {c.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.coverUrl} alt="" className="aspect-square w-full bg-[#0F2544] object-contain" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-[#1C3A63] to-[#0F2544] p-6 text-center font-heading text-3xl font-bold leading-snug text-[#E6CF95]">{c.title}</div>
                )}
                <div className="space-y-2.5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-bold leading-snug">{c.title}</h2>
                    {expired ? <Badge variant="muted">انتهى</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.teacherName} · {c.videos} فيديو · {c.lessons} درس وملف
                  </p>
                  {!expired && p && p.total > 0 ? (
                    <div className="space-y-1">
                      <Progress value={pct} tone={pct === 100 ? 'success' : 'primary'} />
                      <p className="text-[11px] text-muted-foreground">
                        شاهدت {p.seen} من {p.total}
                      </p>
                    </div>
                  ) : null}
                  {!expired && c.nextLive ? (
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-destructive">
                      <span className="size-2 shrink-0 rounded-full bg-destructive" aria-hidden /> الحصة المباشرة القادمة: {formatDateTime(c.nextLive.startsAt)}
                    </p>
                  ) : null}
                  {c.expiresAt || c.accessEndsOn ? (
                    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3.5" /> {expired ? 'انتهى في' : 'حتى'} {formatDate(c.expiresAt ?? c.accessEndsOn)}
                    </p>
                  ) : null}
                  {expired ? (
                    <p className="text-xs text-muted-foreground">انتهت مدة الوصول إلى محتوى هذه الدورة. للتجديد تواصل مع الإدارة.</p>
                  ) : !c.termsAccepted ? (
                    <p className="text-xs font-semibold text-primary">اقرأ شروط الدورة ووافق عليها لتبدأ ←</p>
                  ) : null}
                </div>
              </>
            )
            return expired ? (
              <div key={c.id} className="overflow-hidden rounded-[20px] border bg-card opacity-70 grayscale">
                {body}
              </div>
            ) : (
              <Link key={c.id} href={c.href} className={cn('block overflow-hidden rounded-[20px] border bg-card shadow-soft transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}>
                {body}
              </Link>
            )
          })}
        </div>
      ) : null}

      {/* إضافة دورة: بالكود أو من «الكتب والدورات» */}
      <section className="rounded-[18px] border-2 border-dashed p-4 text-center">
        {items.length === 0 ? (
          <span className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <BookMarked className="size-6" />
          </span>
        ) : null}
        <h2 className="font-bold">{items.length ? 'أضف دورة جديدة' : 'لا دورة مفعّلة بعد'}</h2>
        {items.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">عندك كود من الأستاذ أو المكتبة؟ فعّله. أو اطلب دورة رقمية أو مع الكتاب.</p> : null}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:mx-auto sm:max-w-md">
          <Button asChild variant="outline">
            <Link href="/student/code">
              <KeyRound className="size-4" /> تفعيل بالكود
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/student/courses/catalog">
              <ShoppingBag className="size-4" /> الكتب والدورات
            </Link>
          </Button>
        </div>
      </section>

      {pendingOrders.length ? (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">بانتظار التفعيل</h2>
          <p className="text-sm text-muted-foreground">تُفعَّل الدورة المرتبطة بالكتاب بعد تأكيد التسليم من شركة التوصيل.</p>
          <MyOrdersTracking orders={pendingOrders.map((o) => ({ ...o, createdAt: o.createdAt.toISOString(), timeline: o.timeline.map((t) => ({ ...t, at: t.at.toISOString() })) }))} />
        </section>
      ) : null}
    </div>
  )
}
