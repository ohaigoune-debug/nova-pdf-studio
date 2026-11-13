import { eq } from 'drizzle-orm'
import { ArrowRight, BookOpen, CheckCircle2, FileText, Gamepad2, PackageCheck, PlayCircle, Radio, Truck } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { CourseOrderForm } from '@/components/academy/course-order-form'
import { ReferralCodeBox } from '@/components/partners/partners-client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/misc'
import { formatDate } from '@/lib/utils'
import { getCurrentActor, homeFor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { products } from '@/server/db/schema'
import { isAppError } from '@/server/lib/errors'
import { courseLanding } from '@/server/services/academy-catalog.service'
import { bookUpgradeOffer, courseBookStateById, courseDigitalStateById } from '@/server/services/course-purchase.service'
import { referralEligibility, referralPolicy } from '@/server/services/referrals.service'
import { courseCheckoutData } from '@/server/services/store.service'
import { recordCourseOrderView } from '@/server/services/course-order-funnel.service'

export const dynamic = 'force-dynamic'

const INCLUDED = [
  { icon: BookOpen, text: 'الكتاب الورقي يصلك إلى البيت أو مكتب التوصيل' },
  { icon: Radio, text: 'الحصص المباشرة مع الأستاذ' },
  { icon: PlayCircle, text: 'تسجيلات الحصص تُشاهَد داخل المنصة' },
  { icon: FileText, text: 'ملفات الدروس والملخّصات' },
  { icon: Gamepad2, text: 'اختبارات وتدريب بعد كل حصة' }
]

const STEPS = [
  { icon: CheckCircle2, title: 'اطلب', text: 'املأ النموذج وأكّد برمز يصل هاتفك.' },
  { icon: Truck, title: 'يصلك الكتاب', text: 'تدفع عند الاستلام فقط.' },
  { icon: PackageCheck, title: 'تُفعَّل الدورة', text: 'تلقائياً على حسابك لحظة التسليم.' }
]

/** صفحة «اطلب الدورة»: طلب الدورة هو طلب كتابها — صفحة هبوط واحدة فيها العرض والنموذج */
export default async function CourseOrderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params
  let slug = rawSlug
  try {
    slug = decodeURIComponent(rawSlug)
  } catch {
    slug = rawSlug
  }
  const actor = await getCurrentActor()
  if (!actor) redirect(`/login?next=${encodeURIComponent(`/student/courses/${slug}/order`)}`)
  if (actor.role !== 'STUDENT') redirect(homeFor(actor.role))
  const db = await getDb()
  let landing: Awaited<ReturnType<typeof courseLanding>>
  try {
    landing = await courseLanding(db, actor, slug)
  } catch (e) {
    if (isAppError(e) && e.code === 'COURSE_NOT_FOUND') notFound()
    throw e
  }
  const { course } = landing
  const courseHref = `/student/courses/${encodeURIComponent(course.slug)}`
  // المشترك يُعاد إلى دورته، إلا من اشترى النسخة الرقمية ويطلب الكتاب الورقي (يدفع الفرق فقط)
  const upgrade = course.enrollment === 'ACTIVE' ? await bookUpgradeOffer(db, actor, course.id) : null
  if (course.enrollment === 'ACTIVE' && !upgrade) redirect(courseHref)
  const [purchase, checkout, digital, refEl, refPolicy] = await Promise.all([courseBookStateById(db, course.id), courseCheckoutData(db, actor), courseDigitalStateById(db, course.id), referralEligibility(db, actor.userId), referralPolicy(db)])
  const price = upgrade ? upgrade.priceDzd : (purchase.book?.priceDzd ?? 0)
  // لقياس إتمام الطلب في لوحة الإدارة (البند ب4)
  if (purchase.purchasable && purchase.book) await recordCourseOrderView(db, actor.userId, course.id)
  const [cover] = purchase.book ? await db.select({ url: products.coverUrl }).from(products).where(eq(products.id, purchase.book.id)).limit(1) : []
  const bookCover = cover?.url ?? null

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href={courseHref}>
          <ArrowRight className="size-4 rtl:rotate-0 ltr:rotate-180" /> تفاصيل الدورة
        </Link>
      </Button>

      <section className="bg-ink bg-pattern overflow-hidden rounded-xl text-white">
        <div className="grid items-center gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <Badge className="border-white/20 bg-white/10 text-white">{upgrade ? 'الكتاب الورقي لمشترك النسخة الرقمية' : 'الدورة + الكتاب الورقي'}</Badge>
            <h1 className="font-display text-3xl font-bold leading-snug sm:text-4xl">{course.title}</h1>
            <p className="text-white/75">
              {course.teacherName} · {course.season}
              {course.accessEndsOn ? ` · الوصول حتى ${formatDate(course.accessEndsOn)}` : ''}
            </p>
            {purchase.book ? (
              <p className="text-4xl font-extrabold tabular-nums">
                {price} <span className="text-lg font-bold text-white/75">دج + التوصيل</span>
              </p>
            ) : null}
          </div>
          {bookCover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bookCover} alt={purchase.book?.title ?? ''} className="mx-auto h-48 w-auto rounded-lg border border-white/20 object-contain shadow-lift md:h-56" />
          ) : course.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={course.coverUrl} alt="" className="mx-auto h-40 w-full max-w-xs rounded-lg border border-white/20 object-cover md:h-48" />
          ) : null}
        </div>
      </section>

      {upgrade ? <Alert tone="info" title="تدفع الفرق فقط">أنت مشترك في النسخة الرقمية: يُخصم ما دفعته من سعر الدورة مع الكتاب. دورتك تبقى مفتوحة كما هي.</Alert> : null}
      {!upgrade && digital.purchasable && digital.priceDzd ? (
        <p className="text-sm text-muted-foreground">
          لا تحتاج الكتاب الورقي؟{' '}
          <Link href={`${courseHref}/digital`} className="font-semibold text-primary underline">
            النسخة الرقمية بـ {digital.priceDzd} دج
          </Link>{' '}
          — عرض منفصل، بالبطاقة، دون كتاب.
        </p>
      ) : null}
      {course.enrollment === 'EXPIRED' ? <Alert tone="warning" title="انتهت مدة اشتراكك السابق">اطلب الدورة مع الكتاب من جديد لتجديد الوصول.</Alert> : null}
      {course.enrollment === 'REVOKED' ? <Alert tone="destructive" title="اشتراكك في هذه الدورة موقوف">تواصل مع الإدارة من صفحة الدعم والشكاوى قبل طلب جديد.</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>ماذا تحصل عليه؟</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                {INCLUDED.map((x) => (
                  <li key={x.text} className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <x.icon className="size-4" />
                    </span>
                    {x.text}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>كيف يتم؟</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="flex gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                    <span>
                      <span className="block font-bold">{s.title}</span>
                      <span className="block text-sm text-muted-foreground">{s.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <Card id="order" className="order-first border-primary/30 lg:order-none">
          <CardHeader>
            <CardTitle>{upgrade ? 'اطلب الكتاب الورقي' : 'اطلب الدورة مع الكتاب'}</CardTitle>
            {purchase.book ? <p className="text-sm text-muted-foreground">{upgrade ? `يصلك كتاب «${purchase.book.title}» إلى البيت أو مكتب التوصيل.` : `يصلك كتاب «${purchase.book.title}» وتُفعَّل الدورة على حسابك عند التسليم.`}</p> : null}
          </CardHeader>
          <CardContent>
            {purchase.purchasable && purchase.book ? (
              <div className="space-y-5">
                {refEl.eligible ? <ReferralCodeBox source="CHECKOUT" welcomeCreditDzd={refPolicy.welcomeCreditDzd} /> : null}
                <CourseOrderForm courseId={course.id} book={{ title: purchase.book.title, priceDzd: price }} data={checkout} />
              </div>
            ) : (
              <Alert tone="warning" title="الطلب غير متاح حالياً">
                شراء هذه الدورة متوقف مؤقتاً. راجعنا من{' '}
                <Link href="/student/support" className="underline">
                  الدعم والشكاوى
                </Link>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
