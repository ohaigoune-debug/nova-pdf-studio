import { BookOpen, FileText, Package, ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import { CartBadge } from '@/components/domain/store-cart'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { PRODUCT_TYPES, type ProductType } from '@/server/db/schema/enums'
import { bankFormOptions } from '@/server/queries/bank-options'
import { listProducts, PRODUCT_TYPE_AR } from '@/server/services/store.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'المتجر' }

const ICON: Record<ProductType, typeof BookOpen> = { BOOK: BookOpen, PDF: FileText, PACK: Package }

/** متجر الكتب (المرحلة 10): كتب ورقية وملفات PDF وحزم، مصنّفة بالمادة والصف */
export default async function StorePage({ searchParams }: { searchParams: Promise<{ type?: string; subject?: string; level?: string; q?: string }> }) {
  const sp = await searchParams
  const type = PRODUCT_TYPES.includes(sp.type as ProductType) ? (sp.type as ProductType) : null
  const db = await getDb()
  const actor = await getCurrentActor()
  const [items, opts] = await Promise.all([listProducts(db, { type, subjectId: sp.subject || null, levelId: sp.level || null, q: sp.q || null }), bankFormOptions(db, { userId: '', role: 'STUDENT', fullName: '', email: '', workspaceId: null, teacherId: null, studentId: null })])
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v)
    const s = p.toString()
    return `/store${s ? `?${s}` : ''}`
  }
  return (
    <div className="container py-10">
      <PageHeader
        title="المتجر"
        description="كتب ورقية تصلك إلى بيتك بالدفع عند الاستلام، وملفات PDF تُنزَّل فوراً بعد التأكيد."
        actions={
          <div className="flex items-center gap-2">
            {actor ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/store/orders">طلباتي</Link>
              </Button>
            ) : null}
            <CartBadge />
          </div>
        }
      />
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <Input name="q" defaultValue={sp.q ?? ''} placeholder="ابحث عن كتاب أو مؤلّف…" dir="auto" />
        <Select name="subject" defaultValue={sp.subject ?? ''} aria-label="المادة">
          <option value="">كل المواد</option>
          {opts.subjects.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <Select name="level" defaultValue={sp.level ?? ''} aria-label="الصف">
          <option value="">كل الصفوف</option>
          {opts.levels.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline">
          تصفية
        </Button>
      </form>
      <nav className="mb-6 flex flex-wrap gap-2 text-sm" aria-label="النوع">
        <Link href={href({ type: undefined })} className={cn('rounded-full border px-3 py-1.5', !type ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')}>
          الكل
        </Link>
        {PRODUCT_TYPES.map((t) => (
          <Link key={t} href={href({ type: t })} className={cn('rounded-full border px-3 py-1.5', type === t ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')}>
            {PRODUCT_TYPE_AR[t]}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="لا منتجات بعد" description="تظهر هنا الكتب والملفات حين ينشرها المشرف." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((p) => {
            const Icon = ICON[p.type]
            return (
              <li key={p.id} className="overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
                <Link href={`/store/${p.slug}`} className="block">
                  {p.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.coverUrl} alt="" className="aspect-[3/4] w-full object-cover" />
                  ) : (
                    <div className="flex aspect-[3/4] items-center justify-center bg-muted">
                      <Icon className="size-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="space-y-1 p-3">
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary">{PRODUCT_TYPE_AR[p.type]}</Badge>
                      {!p.inStock ? <Badge variant="muted">نفد</Badge> : null}
                    </div>
                    <p className="line-clamp-2 font-bold">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{[p.author, p.subjectName, p.levelName].filter(Boolean).join(' · ')}</p>
                    <p className="tabular font-extrabold">
                      {p.priceDzd === 0 ? 'مجاني' : `${p.priceDzd} دج`}
                      {p.comparePriceDzd && p.comparePriceDzd > p.priceDzd ? <span className="ms-2 text-xs font-normal text-muted-foreground line-through">{p.comparePriceDzd} دج</span> : null}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
