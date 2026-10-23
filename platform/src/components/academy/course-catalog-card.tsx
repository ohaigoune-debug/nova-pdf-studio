import { BookMarked, Clock } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import type { CatalogCourse } from '@/server/services/academy-catalog.service'

export const priceLabel = (dzd: number) => (dzd === 0 ? 'مجانية' : `${dzd.toLocaleString('ar-DZ')} دج`)

/** بطاقة دورة في الكتالوج: عرض فقط — الزر يقود إلى صفحة التعريف أو إلى الدورة إن كان الاشتراك سارياً */
export function CourseCatalogCard({ c }: { c: CatalogCourse }) {
  const active = c.enrollment === 'ACTIVE'
  return (
    <Card className="overflow-hidden">
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
          <Badge variant={c.priceDzd === 0 ? 'success' : 'default'}>{priceLabel(c.priceDzd)}</Badge>
        </div>
        {c.description ? <p className="line-clamp-3 text-sm text-muted-foreground">{c.description}</p> : null}
        <div className="flex flex-wrap gap-1.5 text-xs">
          {c.levelName ? <Badge variant="muted">{c.levelName}</Badge> : null}
          {c.subjectName ? <Badge variant="muted">{c.subjectName}</Badge> : null}
          {c.streamNames.length ? c.streamNames.map((s) => <Badge key={s} variant="muted">{s}</Badge>) : <Badge variant="muted">كل الشعب</Badge>}
        </div>
        {c.accessEndsOn ? (
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" /> الوصول حتى {formatDate(c.accessEndsOn)}
          </p>
        ) : null}
        <Button asChild className="w-full" variant={active ? 'default' : 'outline'}>
          <Link href={c.href}>{active ? 'دخول الدورة' : c.enrollment === 'EXPIRED' ? 'انتهى اشتراكك — التفاصيل' : 'التفاصيل وكيفية الاشتراك'}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
