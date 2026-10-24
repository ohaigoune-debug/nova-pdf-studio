import { BookMarked, Clock, KeyRound, ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, PageHeader } from '@/components/ui/misc'
import { formatDate } from '@/lib/utils'
import type { CourseLanding } from '@/server/services/academy-catalog.service'
import { priceLabel } from './course-catalog-card'

/** صفحة تعريف الدورة لغير المشترك: ما هي، لمن، بكم، وكيف يُفعَّل الاشتراك. لا محتوى هنا. */
export function CourseLandingView({ landing }: { landing: CourseLanding }) {
  const { course, products } = landing
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

      {course.enrollment === 'EXPIRED' ? <Alert tone="warning" title="انتهت مدة اشتراكك في هذه الدورة">للتجديد تواصل مع الإدارة من صفحة الدعم أو أعد الشراء من المتجر.</Alert> : null}
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
          <CardDescription>اطلب الكتاب فهو طلب الدورة: يصلك الكتاب بالدفع عند الاستلام، وتُفعَّل الدورة على حسابك لحظة التسليم تلقائياً. وإن كان معك كود مطبوع في الكتاب فأدخله من حسابك.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {products.length ? (
            <ul className="divide-y rounded-lg border">
              {products.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="font-semibold">{p.title}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="muted">{priceLabel(p.priceDzd)}</Badge>
                    <Button asChild size="sm">
                      <Link href={p.href}>
                        <ShoppingBag className="size-4" /> اطلب الكتاب
                      </Link>
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">لا منتج مرتبط بهذه الدورة في المتجر حالياً؛ اطلب التفعيل من الإدارة.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/activate-code">
                <KeyRound className="size-4" /> لديّ كود الكتاب
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/claim">
                <KeyRound className="size-4" /> وصلني رمز بالـSMS
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
