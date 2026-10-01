'use client'

import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert, EmptyState } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { placeOrderAction } from '@/server/actions/store.actions'

export interface CartItem {
  productId: string
  slug: string
  title: string
  priceDzd: number
  qty: number
  physical: boolean
}

const KEY = 'md-cart-v1'
const read = (): CartItem[] => {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null
    const v = raw ? (JSON.parse(raw) as CartItem[]) : []
    return Array.isArray(v) ? v.filter((i) => i && typeof i.productId === 'string') : []
  } catch {
    return []
  }
}
const write = (items: CartItem[]) => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items))
    window.dispatchEvent(new Event('md-cart'))
  } catch {
    /* التخزين غير متاح (وضع خاص) — السلّة تبقى في الذاكرة فقط */
  }
}

/** السلّة محلية في المتصفح (لا حساب مطلوب للتصفّح)، وتُرسل كاملة عند الطلب */
export function useCart() {
  const [items, setItems] = useState<CartItem[]>([])
  useEffect(() => {
    setItems(read())
    const on = () => setItems(read())
    window.addEventListener('md-cart', on)
    window.addEventListener('storage', on)
    return () => {
      window.removeEventListener('md-cart', on)
      window.removeEventListener('storage', on)
    }
  }, [])
  const add = (item: Omit<CartItem, 'qty'>, qty = 1) => {
    const cur = read()
    const hit = cur.find((i) => i.productId === item.productId)
    if (hit) hit.qty = Math.min(20, hit.qty + qty)
    else cur.push({ ...item, qty })
    write(cur)
  }
  const setQty = (productId: string, qty: number) => write(read().map((i) => (i.productId === productId ? { ...i, qty: Math.max(1, Math.min(20, qty)) } : i)))
  const remove = (productId: string) => write(read().filter((i) => i.productId !== productId))
  const clear = () => write([])
  return { items, add, setQty, remove, clear, count: items.reduce((s, i) => s + i.qty, 0), total: items.reduce((s, i) => s + i.qty * i.priceDzd, 0) }
}

export function AddToCartButton({ item, disabled }: { item: Omit<CartItem, 'qty'>; disabled?: boolean }) {
  const { add } = useCart()
  const router = useRouter()
  return (
    <Button
      size="lg"
      disabled={disabled}
      onClick={() => {
        add(item)
        toast('success', 'أُضيف إلى السلّة')
        router.push('/store/cart')
      }}
    >
      <ShoppingCart className="size-4" /> {disabled ? 'غير متوفر' : item.priceDzd === 0 ? 'احصل عليه مجاناً' : 'أضف إلى السلّة'}
    </Button>
  )
}

export function CartBadge() {
  const { count } = useCart()
  return (
    <Link href="/store/cart" className="relative inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm hover:border-primary/50" aria-label="السلّة">
      <ShoppingCart className="size-4" /> السلّة
      {count ? <span className="tabular rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{count}</span> : null}
    </Link>
  )
}

/** صفحة السلّة والطلب: التصفّح للجميع، والإرسال لمن سجّل دخوله */
export function CartPage({ loggedIn, defaults, wilayas, shippingDzd }: { loggedIn: boolean; defaults: { name: string; phone: string | null } | null; wilayas: { id: string; name: string }[]; shippingDzd: number }) {
  const cart = useCart()
  const router = useRouter()
  const [pending, start] = useTransition()
  const [f, setF] = useState({ customerName: defaults?.name ?? '', phone: defaults?.phone ?? '', wilayaId: '', address: '', note: '' })
  const physical = cart.items.some((i) => i.physical)
  const shipping = physical ? shippingDzd : 0
  const total = cart.total + shipping
  const submit = () =>
    start(async () => {
      const r = await placeOrderAction({ items: cart.items.map((i) => ({ productId: i.productId, qty: i.qty })), customerName: f.customerName, phone: f.phone, wilayaId: f.wilayaId || null, address: f.address || null, note: f.note || null })
      if (!r.ok) return toast('error', r.error.message)
      cart.clear()
      toast('success', r.data.status === 'DELIVERED' ? 'طلبك جاهز: ملفاتك متاحة للتنزيل' : `أُرسل طلبك ${r.data.number}`)
      router.push(`/store/orders/${r.data.id}`)
    })
  if (cart.items.length === 0) return <EmptyState icon={ShoppingCart} title="السلّة فارغة" action={<Button asChild><Link href="/store">تصفّح المتجر</Link></Button>} />
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>السلّة</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {cart.items.map((i) => (
              <li key={i.productId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <Link href={`/store/${i.slug}`} className="min-w-0 flex-1 font-semibold hover:underline">
                  {i.title}
                </Link>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => cart.setQty(i.productId, i.qty - 1)} aria-label="أقل">
                    <Minus className="size-3" />
                  </Button>
                  <span className="tabular w-8 text-center">{i.qty}</span>
                  <Button size="sm" variant="outline" onClick={() => cart.setQty(i.productId, i.qty + 1)} aria-label="أكثر">
                    <Plus className="size-3" />
                  </Button>
                </div>
                <span className="tabular w-24 text-end">{i.priceDzd * i.qty} دج</span>
                <Button size="sm" variant="ghost" onClick={() => cart.remove(i.productId)} aria-label="إزالة">
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 border-t pt-3 text-sm">
            <p className="flex justify-between">
              <span>المجموع</span>
              <span className="tabular">{cart.total} دج</span>
            </p>
            {physical ? (
              <p className="flex justify-between text-muted-foreground">
                <span>الشحن</span>
                <span className="tabular">{shipping ? `${shipping} دج` : 'يُحدَّد عند التأكيد'}</span>
              </p>
            ) : null}
            <p className="flex justify-between text-base font-bold">
              <span>الإجمالي</span>
              <span className="tabular">{total} دج</span>
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>إتمام الطلب</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!loggedIn ? (
            <Alert tone="info">
              سجّل الدخول لإرسال الطلب ومتابعته.
              <Button asChild size="sm" className="mt-2 w-full">
                <Link href="/login?next=/store/cart">تسجيل الدخول</Link>
              </Button>
            </Alert>
          ) : (
            <>
              <Field label="الاسم الكامل" htmlFor="c-name">
                <Input id="c-name" value={f.customerName} onChange={(e) => setF((s) => ({ ...s, customerName: e.target.value }))} dir="auto" />
              </Field>
              <Field label="الهاتف" htmlFor="c-phone" hint="05 / 06 / 07">
                <Input id="c-phone" value={f.phone} onChange={(e) => setF((s) => ({ ...s, phone: e.target.value }))} dir="ltr" inputMode="tel" placeholder="05XXXXXXXX" />
              </Field>
              {physical ? (
                <>
                  <Field label="الولاية" htmlFor="c-wilaya">
                    <Select id="c-wilaya" value={f.wilayaId} onChange={(e) => setF((s) => ({ ...s, wilayaId: e.target.value }))}>
                      <option value="">—</option>
                      {wilayas.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="العنوان" htmlFor="c-address">
                    <Textarea id="c-address" rows={2} value={f.address} onChange={(e) => setF((s) => ({ ...s, address: e.target.value }))} dir="auto" />
                  </Field>
                </>
              ) : null}
              <Field label="ملاحظة" htmlFor="c-note">
                <Input id="c-note" value={f.note} onChange={(e) => setF((s) => ({ ...s, note: e.target.value }))} dir="auto" />
              </Field>
              <Alert tone="info">{total === 0 ? 'طلب مجاني: ملفاتك تُتاح فوراً.' : physical ? 'الدفع عند الاستلام. نتصل بك للتأكيد ثم نشحن.' : 'ملفات رقمية: تحوّل المبلغ (CCP / BaridiMob) وتُرسل الوصل، ويؤكّد المشرف الطلب فتُفتح التنزيلات.'}</Alert>
              <Button className="w-full" size="lg" onClick={submit} loading={pending} disabled={!f.customerName.trim() || !f.phone.trim() || (physical && (!f.wilayaId || !f.address.trim()))}>
                إرسال الطلب
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
