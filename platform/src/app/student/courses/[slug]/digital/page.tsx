import { ArrowRight, CheckCircle2, CreditCard, FileText, Gamepad2, MonitorPlay, PackageX, PlayCircle, Radio } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { DigitalCheckout } from '@/components/academy/digital-checkout'
import { ReferralCodeBox } from '@/components/partners/partners-client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/misc'
import { formatDate } from '@/lib/utils'
import { getCurrentActor, homeFor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { courseLanding } from '@/server/services/academy-catalog.service'
import { courseBookStateById, courseDigitalStateById } from '@/server/services/course-purchase.service'
import { creditPreview, referralEligibility, referralPolicy } from '@/server/services/referrals.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'النسخة الرقمية' }

const INCLUDED = [
  { icon: Radio, text: 'الحصص المباشرة مع الأستاذ' },
  { icon: PlayCircle, text: 'تسجيلات الحصص تُشاهَد داخل المنصة' },
  { icon: FileText, text: 'ملفات الدروس والملخّصات' },
  { icon: Gamepad2, text: 'اختبارات وتدريب بعد كل حصة' }
]

const STEPS = [
  { icon: CheckCircle2, title: 'أكّد', text: 'أنك فهمت أنها نسخة رقمية دون كتاب.' },
  { icon: CreditCard, title: 'ادفع بالبطاقة', text: 'CIB أو الذهبية في صفحة SATIM الرسمية.' },
  { icon: MonitorPlay, title: 'تُفتح الدورة فورًا', text: 'على حسابك، لحظة تأكّد الدفع.' }
]

/**
 * صفحة «النسخة الرقمية» (قرار المالك 2 نوفمبر 2026): عرض مستقل عن «الدورة مع الكتاب» — بطاقته في الكتالوج
 * وصفحته هنا. تفتح الدورة نفسها دون كتاب ولا توصيل، بالبطاقة فقط، فور تأكّد الخادم من الدفع.
 */
export default async function CourseDigitalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params
  let slug = rawSlug
  try {
    slug = decodeURIComponent(rawSlug)
  } catch {
    slug = rawSlug
  }
  const actor = await getCurrentActor()
  if (!actor) redirect(`/login?next=${encodeURIComponent(`/student/courses/${slug}/digital`)}`)
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
  if (course.enrollment === 'ACTIVE') redirect(courseHref)
  const [digital, book] = await Promise.all([courseDigitalStateById(db, course.id), courseBookStateById(db, course.id)])
  if (!digital.priceDzd) notFound()
  const [credit, refEl, refPolicy] = await Promise.all([creditPreview(db, actor.userId, { priceDzd: digital.priceDzd, totalDzd: digital.priceDzd, online: true }), referralEligibility(db, actor.userId), referralPolicy(db)])

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
            <Badge className="border-white/20 bg-white/10 text-white">النسخة الرقمية — دون كتاب ورقي</Badge>
            <h1 className="font-display text-3xl font-bold leading-snug sm:text-4xl">{course.title}</h1>
            <p className="text-white/75">
              {course.teacherName} · {course.season}
              {course.accessEndsOn ? ` · الوصول حتى ${formatDate(course.accessEndsOn)}` : ''}
            </p>
            <p className="text-4xl font-extrabold tabular-nums">
              {digital.priceDzd} <span className="text-lg font-bold text-white/75">دج · بالبطاقة · بلا توصيل</span>
            </p>
          </div>
          {course.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={course.coverUrl} alt="" className="mx-auto h-40 w-full max-w-xs rounded-lg border border-white/20 object-cover md:h-48" />
          ) : (
            <MonitorPlay className="mx-auto size-24 text-white/60" />
          )}
        </div>
      </section>

      {course.enrollment === 'EXPIRED' ? <Alert tone="warning" title="انتهت مدة اشتراكك السابق">اشترِ من جديد لتجديد الوصول.</Alert> : null}
      {course.enrollment === 'REVOKED' ? <Alert tone="destructive" title="اشتراكك في هذه الدورة موقوف">تواصل مع الإدارة من صفحة الدعم والشكاوى قبل أي شراء.</Alert> : null}

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
                <li className="flex items-center gap-3 font-semibold text-destructive">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-destructive/10">
                    <PackageX className="size-4" />
                  </span>
                  لا كتاب ورقي في هذه النسخة
                </li>
              </ul>
              {book.purchasable && book.book ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  تريد الكتاب الورقي؟{' '}
                  <Link href={`${courseHref}/order`} className="font-semibold text-primary underline">
                    الدورة مع الكتاب بـ {book.book.priceDzd} دج + التوصيل
                  </Link>{' '}
                  — عرض منفصل.
                </p>
              ) : null}
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

        <Card className="order-first border-primary/30 lg:order-none">
          <CardHeader>
            <CardTitle>اشترِ النسخة الرقمية</CardTitle>
            <p className="text-sm text-muted-foreground">تُفتح «{course.title}» على حسابك فور الدفع. لا عنوان ولا توصيل.</p>
          </CardHeader>
          <CardContent>
            {digital.purchasable ? (
              <div className="space-y-4">
                {refEl.eligible ? <ReferralCodeBox source="CHECKOUT" welcomeCreditDzd={refPolicy.welcomeCreditDzd} /> : null}
                <DigitalCheckout courseId={course.id} priceDzd={digital.priceDzd} credit={credit} />
              </div>
            ) : (
              <Alert tone="warning" title="الشراء غير متاح حالياً">
                النسخة الرقمية متوقفة مؤقتاً. راجعنا من{' '}
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
