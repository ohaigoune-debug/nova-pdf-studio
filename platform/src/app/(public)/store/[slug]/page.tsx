import { ArrowRight, BookOpen, FileText, Package, Truck } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AddToCartButton, CartBadge } from '@/components/domain/store-cart'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, PageHeader } from '@/components/ui/misc'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import type { ListingKind } from '@/server/db/schema/enums'
import { LISTING_KIND_AR } from '@/server/services/marketplace.service'
import { getProduct, PRODUCT_TYPE_AR, shippingFeeDzd } from '@/server/services/store.service'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  try {
    const p = await getProduct(await getDb(), decodeURIComponent(slug))
    return { title: p.title, description: p.description?.slice(0, 160) }
  } catch {
    return { title: 'المتجر' }
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let p
  try {
    p = await getProduct(await getDb(), decodeURIComponent(slug))
  } catch (e) {
    if (e instanceof AppError) notFound()
    throw e
  }
  const Icon = p.type === 'BOOK' ? BookOpen : p.type === 'PDF' ? FileText : Package
  const fee = shippingFeeDzd()
  return (
    <div className="container py-10">
      <PageHeader
        title={p.title}
        description={[p.author, p.subjectName, p.levelName].filter(Boolean).join(' · ')}
        actions={
          <div className="flex items-center gap-2">
            <CartBadge />
            <Button asChild variant="outline" size="sm">
              <Link href="/store">
                <ArrowRight className="size-4" /> المتجر
              </Link>
            </Button>
          </div>
        }
      />
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-1">
          {p.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.coverUrl} alt="" className="w-full rounded-xl border object-cover" />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center rounded-xl border bg-muted">
              <Icon className="size-16 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{p.listing ? LISTING_KIND_AR[p.listing.kind as ListingKind] : PRODUCT_TYPE_AR[p.type]}</Badge>
            {p.sellerName ? <Badge variant="default">من الأستاذ: {p.sellerName}</Badge> : null}
            {p.listing?.teachersOnly ? <Badge variant="warning">للأساتذة: يُنسخ إلى ورشتك</Badge> : null}
            {p.pages ? <Badge variant="muted">{p.pages} صفحة</Badge> : null}
            {p.physical ? p.inStock ? <Badge variant="success">متوفر{p.stock !== null ? ` (${p.stock})` : ''}</Badge> : <Badge variant="destructive">نفد المخزون</Badge> : null}
          </div>
          <p className="tabular text-3xl font-extrabold">
            {p.priceDzd === 0 ? 'مجاني' : `${p.priceDzd} دج`}
            {p.comparePriceDzd && p.comparePriceDzd > p.priceDzd ? <span className="ms-3 text-base font-normal text-muted-foreground line-through">{p.comparePriceDzd} دج</span> : null}
          </p>
          <AddToCartButton item={{ productId: p.id, slug: p.slug, title: p.title, priceDzd: p.priceDzd, physical: p.physical }} disabled={!p.inStock} />
          {p.description ? <p className="whitespace-pre-line text-[15px] leading-8" dir="auto">{p.description}</p> : null}
          {p.physical ? (
            <Alert tone="info">
              <Truck className="me-1 inline size-4" /> يُشحن إلى كل الولايات والدفع عند الاستلام{fee ? ` (شحن ${fee} دج)` : ''}.
            </Alert>
          ) : null}
          {p.listing && p.listing.kind !== 'SUMMARY' ? (
            <Alert tone="info">{p.listing.kind === 'EXAM' ? 'بعد التأكيد تظهر نسخة من الامتحان في «الامتحانات» عندك، قابلة للتعديل والطباعة بنسخ A/B/C/D.' : 'بعد التأكيد تُنسخ الأسئلة إلى بنكك مع ذكر المصدر.'}</Alert>
          ) : p.digital ? (
            <Alert tone="info">
              <FileText className="me-1 inline size-4" /> {p.files.length ? `${p.files.length} ملف رقمي` : 'ملفات رقمية'} تُتاح للتنزيل من «طلباتي» بعد {p.priceDzd === 0 ? 'الطلب مباشرة' : 'تأكيد الدفع'}.
              {p.files.length ? <ul className="mt-1 text-xs text-muted-foreground">{p.files.map((f) => <li key={f.id}>{f.label ?? f.name} · {Math.max(1, Math.round(f.sizeBytes / 1024 / 1024))} م.ب</li>)}</ul> : null}
            </Alert>
          ) : null}
        </div>
      </div>
    </div>
  )
}
