import { BookMarked, Clock, KeyRound } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, PageHeader } from '@/components/ui/misc'
import { formatDate } from '@/lib/utils'
import type { CourseLanding } from '@/server/services/academy-catalog.service'
import { BuyCourseDialog, type CheckoutData } from './buy-course-dialog'
import { priceLabel } from './course-catalog-card'

/** صفحة تعريف الدورة لغير المشترك: ما هي، لمن، بكم، وكيف يُفعَّل الاشتراك. لا محتوى هنا. */
export function CourseLandingView({ landing, checkout, purchase }: { landing: CourseLanding; checkout?: CheckoutData | null; purchase?: { book: { title: string; priceDzd: number } | null; purchasable: boolean } | null }) {
  const { course } = landing
  return (
    <div className="space-y-6">
      <PageHeader
        title={course.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {course.teacherName} · {course.season}
            </span>
            <Badge variant={course.priceDzd === 0 ? 'success' : 'default'}>{priceLabel(course.priceDzd)}</Badge>
            {course.accessEndsOn ? (
              <Badge variant="secondary">
                <Clock className="size-3" /> الوصول حتى {formatDate(course.accessEndsOn)}
              </Badge>
            ) : null}
          </span>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/student/courses/catalog">كتالوج الدورات</Link>
          </Button>
        }
      />

      {course.enrollment === 'EXPIRED' ? <Alert tone="warning" title="انتهت مدة اشتراكك في هذه الدورة">للتجديد تواصل مع الإدارة من صفحة الدعم أو اشترِ الدورة مع الكتاب من جديد.</Alert> : null}
      {course.enrollment === 'REVOKED' ? <Alert tone="destructive" title="اشتراكك في هذه الدورة موقوف">تواصل مع الإدارة من صفحة الدعم والشكاوى.</Alert> : null}

      {course.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={course.coverUrl} alt="" className="max-h-56 w-full rounded-xl border object-cover" />
      ) : null}
      {course.description ? <p className="text-sm leading-relaxed text-muted-foreground">{course.description}</p> : null}

      <div className="flex flex-wrap gap-1.5 text-xs">
        {course.levelName ? <Badge variant="muted">{course.levelName}</Badge> : null}
        {course.subjectName ? <Badge variant="muted">{course.subjectName}</Badge> : null}
        {course.streamNames.length ? course.streamNames.map((s) => <Badge key={s} variant="muted">{s}</Badge>) : <Badge variant="muted">كل الشعب</Badge>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookMarked className="size-5 text-primary" /> كيف أشترك؟
          </CardTitle>
          <CardDescription>اطلب الكتاب فهو طلب الدورة: يصلك الكتاب بالدفع عند الاستلام، وتُفعَّل الدورة على حسابك لحظة التسليم تلقائياً. وإن لم تُفعَّل، ترسل لك الإدارة كود تفعيل على هاتفك أو هاتف وليّك.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {purchase?.book && purchase.purchasable && checkout ? (
            <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <span>
                <span className="block text-sm text-muted-foreground">الدورة مع الكتاب: «{purchase.book.title}»</span>
                <span className="block text-2xl font-extrabold">{priceLabel(purchase.book.priceDzd)}</span>
                <span className="block text-xs text-muted-foreground">+ التوصيل حسب ولايتك · الدفع عند الاستلام</span>
              </span>
              <BuyCourseDialog courseId={course.id} courseTitle={course.title} book={purchase.book} data={checkout} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">شراء هذه الدورة غير متاح حالياً. تواصل مع الدعم، أو أدخل كود التفعيل إن كان لديك.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/claim">
                <KeyRound className="size-4" /> لديّ كود تفعيل
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/student/support">الدعم والشكاوى</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
