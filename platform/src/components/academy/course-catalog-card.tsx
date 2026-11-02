import { BookMarked, BookOpen, Clock, MonitorPlay } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import type { CatalogCourse } from '@/server/services/academy-catalog.service'

export const priceLabel = (dzd: number) => (dzd === 0 ? 'مجانية' : `${dzd.toLocaleString('ar-DZ')} دج`)

/**
 * بطاقة دورة في الكتالوج: عرض فقط — الزر يقود إلى صفحة التعريف أو إلى الدورة إن كان الاشتراك سارياً.
 * offer: حين للدورة عرضان، لكلٍّ بطاقته المستقلة وصفحته (قرار المالك 2 نوفمبر 2026):
 *   book ⇒ «الدورة + الكتاب الورقي» بسعر الكتاب، وdigital ⇒ «النسخة الرقمية — دون كتاب» بسعرها، بالبطاقة.
 */
export function CourseCatalogCard({ c, offer }: { c: CatalogCourse; offer?: 'book' | 'digital' }) {
  const active = c.enrollment === 'ACTIVE'
  const digital = offer === 'digital'
  const price = digital ? (c.digitalPriceDzd ?? c.priceDzd) : c.priceDzd
  const href = offer && !active ? `${c.href}/${digital ? 'digital' : 'order'}` : c.href
  return (
    <Card className="overflow-hidden">
      {c.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.coverUrl} alt="" className="aspect-[16/7] w-full object-cover" />
      ) : (
        <div className="flex aspect-[16/7] w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
          {digital ? <MonitorPlay className="size-10" /> : <BookMarked className="size-10" />}
        </div>
      )}
      {offer ? (
        <div className={digital ? 'flex items-center gap-2 bg-secondary px-5 py-2 text-sm font-bold text-secondary-foreground' : 'flex items-center gap-2 bg-primary px-5 py-2 text-sm font-bold text-primary-foreground'}>
          {digital ? <MonitorPlay className="size-4" /> : <BookOpen className="size-4" />}
          {digital ? 'النسخة الرقمية — دون كتاب ورقي' : 'الدورة + الكتاب الورقي'}
        </div>
      ) : null}
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold leading-snug">{c.title}</h3>
            <p className="text-sm text-muted-foreground">
              {c.teacherName} · {c.season}
            </p>
          </div>
          <Badge variant={price === 0 ? 'success' : 'default'}>{priceLabel(price)}</Badge>
        </div>
        {c.description ? <p className="line-clamp-3 text-sm text-muted-foreground">{c.description}</p> : null}
        <div className="flex flex-wrap gap-1.5 text-xs">
          {c.levelName ? <Badge variant="muted">{c.levelName}</Badge> : null}
          {c.subjectName ? <Badge variant="muted">{c.subjectName}</Badge> : null}
          {c.streamNames.length ? c.streamNames.map((s) => <Badge key={s} variant="muted">{s}</Badge>) : <Badge variant="muted">كل الشعب</Badge>}
        </div>
        {offer && !active ? (
          <p className="text-xs text-muted-foreground">
            {digital ? 'الدفع بالبطاقة (CIB أو الذهبية) وتُفتح الدورة فورًا. لا يصلك كتاب.' : 'يصلك الكتاب إلى البيت أو مكتب التوصيل (+ التوصيل). الدفع عند الاستلام أو بالبطاقة.'}
          </p>
        ) : null}
        {c.accessEndsOn ? (
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" /> الوصول حتى {formatDate(c.accessEndsOn)}
          </p>
        ) : null}
        <Button asChild className="w-full" variant={active ? 'default' : offer ? 'default' : 'outline'}>
          <Link href={href}>{active ? 'دخول الدورة' : digital ? 'اشترِ النسخة الرقمية' : offer ? 'اطلب الدورة مع الكتاب' : c.enrollment === 'EXPIRED' ? 'انتهى اشتراكك — التفاصيل' : 'التفاصيل وكيفية الاشتراك'}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
