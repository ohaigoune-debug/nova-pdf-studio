import { BookMarked, BookOpen, Clock, MonitorPlay } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import type { CatalogCourse } from '@/server/services/academy-catalog.service'

/** سطر التوصيل في بطاقة «الدورة + الكتاب» حسب «التوصيل في السعر» (16 نوفمبر 2026) */
const BOOK_DELIVERY_LINE: Record<CatalogCourse['shippingIncluded'], string> = {
  NONE: 'يصلك الكتاب إلى البيت أو مكتب التوصيل (+ التوصيل).',
  DESK: 'التوصيل إلى مكتب شركة التوصيل مجاني، وإلى البيت بفرق بسيط.',
  HOME: 'التوصيل إلى البيت مجاني — مشمول في السعر.'
}

export const priceLabel = (dzd: number) => (dzd === 0 ? 'مجانية' : `${dzd.toLocaleString('ar-DZ')} دج`)

/**
 * بطاقة دورة في «الكتب والدورات» (التصوّر المعتمد، 21 نوفمبر 2026): بطاقة واحدة لكل دورة، وفيها خياراها
 * جنبًا إلى جنب — «رقمية» (تُفتح فور الدفع بالبطاقة) و«مع الكتاب» (الكتاب الورقي بالتوصيل) — كلٌّ بسعره وصفحته.
 * المشترك يرى «دخول الدورة». عرض فقط: الطلب والدفع في صفحتي /order و/digital كما كانتا.
 */
export function CourseCatalogCard({ c, onlinePay }: { c: CatalogCourse; onlinePay: boolean }) {
  const active = c.enrollment === 'ACTIVE'
  const options = active
    ? []
    : [
        ...(onlinePay && c.digitalPriceDzd !== null
          ? [{ key: 'digital', icon: MonitorPlay, label: 'رقمية', price: c.digitalPriceDzd, hint: 'الحصص والملفات والتمارين على المنصة، تُفتح فور الدفع بالبطاقة.', href: `${c.href}/digital` }]
          : []),
        ...(c.bookOffer ? [{ key: 'book', icon: BookOpen, label: 'مع الكتاب', price: c.priceDzd, hint: `الدورة + الكتاب الورقي. ${BOOK_DELIVERY_LINE[c.shippingIncluded]}`, href: `${c.href}/order` }] : [])
      ]
  return (
    <Card className="overflow-hidden rounded-[20px]">
      {c.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.coverUrl} alt="" className="aspect-square w-full bg-[#0F2544] object-contain" />
      ) : (
        <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 border-b-[3px] border-[#C29B45] bg-gradient-to-br from-[#1C3A63] to-[#0F2544] p-6 text-center text-[#FFFDF7]">
          <BookMarked className="size-10 text-[#E6CF95]" />
          <span className="font-heading text-3xl font-bold leading-snug">{c.title}</span>
        </div>
      )}
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="min-w-0">
          <h3 className="font-bold leading-snug">{c.title}</h3>
          <p className="text-sm text-muted-foreground">
            {c.teacherName} · {c.season}
          </p>
        </div>
        {c.description ? <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p> : null}
        {c.accessEndsOn ? (
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" /> الوصول حتى {formatDate(c.accessEndsOn)}
          </p>
        ) : null}
        {options.length ? (
          <div className="grid grid-cols-2 gap-2.5">
            {options.map((o) => (
              <Link
                key={o.key}
                href={o.href}
                className="flex flex-col gap-1 rounded-[14px] border-2 p-3 transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-center gap-1.5 text-sm font-bold">
                  <o.icon className="size-5 text-primary" /> {o.label}
                </span>
                <span className="text-base font-extrabold tabular-nums">{priceLabel(o.price)}</span>
                <span className="text-[11.5px] leading-snug text-muted-foreground">{o.hint}</span>
              </Link>
            ))}
          </div>
        ) : null}
        <Button asChild className="w-full" variant={active ? 'default' : 'outline'}>
          <Link href={c.href}>{active ? 'دخول الدورة' : c.enrollment === 'EXPIRED' ? 'انتهى اشتراكك — التفاصيل' : options.length ? 'التفاصيل' : 'التفاصيل وكيفية الاشتراك'}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
