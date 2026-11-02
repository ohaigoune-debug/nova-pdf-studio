import { MapPin, Phone, Store } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { getDb } from '@/server/db/client'
import { publicPointsOfSale } from '@/server/services/points-of-sale.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'نقاط البيع' }

/**
 * /points-of-sale — المدارس والمكتبات الشريكة حسب الولاية: يشتري التلميذ الباقة (الكتب + الدورة) بالسعر نفسه،
 * ويأخذ الكتب فورًا مع كود التفعيل. بلا أي رقم مالي.
 */
export default async function PublicPointsOfSalePage() {
  const groups = await publicPointsOfSale(await getDb())
  return (
    <div className="container max-w-3xl space-y-6 py-10">
      <PageHeader title="نقاط البيع" description="اشترِ باقتك (الكتب + الدورة) من أقرب مدرسة أو مكتبة شريكة، بالسعر نفسه: تأخذ الكتب فورًا مع كود التفعيل، ثم تدخل حسابك وتكتب الكود في صفحة «لديّ كود تفعيل»." />
      {groups.length === 0 ? (
        <EmptyState icon={Store} title="لا نقاط بيع بعد" description="تُضاف المدارس والمكتبات الشريكة قريبًا. يمكنك الشراء أونلاين من صفحة الدورة." />
      ) : (
        groups.map((g) => (
          <Card key={g.wilaya}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="size-4 text-primary" /> {g.wilaya}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {g.items.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span>
                      <span className="block font-semibold">{p.name}</span>
                      {p.address ? <span className="block text-sm text-muted-foreground">{p.address}</span> : null}
                    </span>
                    {p.phone ? (
                      <a href={`tel:${p.phone}`} dir="ltr" className="flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-semibold text-primary hover:underline">
                        <Phone className="size-4" /> {p.phone}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
