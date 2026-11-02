'use client'

import { Copy, MessageCircle, PackagePlus, Printer, ShoppingBag, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { formatDateTime } from '@/lib/utils'
import { cancelPosCodeAction, generatePosCodeAction, requestRestockAction } from '@/server/actions/pos.actions'

export interface PosConsoleCode {
  id: string
  code: string | null
  courseTitle: string
  status: 'ACTIVE' | 'USED' | 'CANCELLED'
  priceDzd: number | null
  createdAt: string
  usedAt: string | null
  soldBy: string | null
  cancellable: boolean
}

interface StockLine {
  courseId: string
  courseTitle: string
  sent: number
  sold: number
  remaining: number
  priceDzd: number
}

/** الكود كما يُقرأ ويُملى: 3-4-4 */
const fmt = (code: string) => `${code.slice(0, 3)} ${code.slice(3, 7)} ${code.slice(7)}`
const shareText = (code: string, title: string) => `كود تفعيل «${title}» في منصة مدرسة: ${fmt(code)}\nادخل حسابك ثم افتح madrasadz.com/claim واكتب الكود. يُستعمل مرة واحدة.`
const waLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`

const STATUS: Record<PosConsoleCode['status'], { label: string; variant: 'success' | 'warning' | 'muted' }> = {
  USED: { label: 'فُعِّل', variant: 'success' },
  ACTIVE: { label: 'لم يُفعَّل بعد', variant: 'warning' },
  CANCELLED: { label: 'أُلغي', variant: 'muted' }
}

/**
 * واجهة نقطة البيع: زر كبير لكل دورة «بعت باقة — أعطني الكود»، والعدّاد، والكود الجديد كبيرًا مع واتساب
 * ونسخ وطباعة، ثم قائمة الأكواد بحالتها. كل كود يُولَّد يُحسب بيعًا على النقطة لحظة توليده.
 */
export function PosConsole({ pos, summary, codes }: { pos: { id: string; name: string; status: string; commissionDzd: number }; summary: { stock: StockLine[]; soldCount: number; activatedCount: number; commissionDzd: number; owedDzd: number }; codes: PosConsoleCode[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [last, setLast] = useState<{ code: string; title: string; remaining: number } | null>(null)
  const [restock, setRestock] = useState({ open: false, qty: '', note: '' })
  const open = pos.status === 'ACTIVE'

  const sell = (line: StockLine) =>
    start(async () => {
      if (!window.confirm(`تأكيد: بعت باقة «${line.courseTitle}» بـ ${line.priceDzd} دج؟\nسيُسجَّل البيع على حسابك.`)) return
      const r = await generatePosCodeAction(line.courseId)
      if (!r.ok) return toast('error', r.error.message)
      setLast({ code: r.data.code, title: r.data.courseTitle, remaining: r.data.remaining })
      router.refresh()
    })
  const cancel = (c: PosConsoleCode) =>
    start(async () => {
      if (!window.confirm(`إلغاء الكود ${c.code ? fmt(c.code) : ''}؟ استعمله فقط إن أُرجعت الباقة ولم يُفعَّل الكود.`)) return
      const r = await cancelPosCodeAction(c.id)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'أُلغي الكود وعادت الباقة إلى عدّادك')
      if (last && c.code === last.code) setLast(null)
      router.refresh()
    })
  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      toast('success', 'نُسخ الكود')
    } catch {
      toast('error', 'تعذّر النسخ — اكتبه يدويًّا')
    }
  }
  const sendRestock = () =>
    start(async () => {
      const qty = Number(restock.qty)
      const r = await requestRestockAction({ courseId: summary.stock[0]?.courseId ?? null, qty: Number.isInteger(qty) && qty > 0 ? qty : null, note: restock.note || null })
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'أُرسل طلبك إلى إدارة المنصة')
      setRestock({ open: false, qty: '', note: '' })
    })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">{pos.name}</h1>
        <p className="text-sm text-muted-foreground">عند كل بيع: اضغط الزر، وأعطِ التلميذ الكود مع الباقة.</p>
      </div>

      {!open ? <Alert tone="warning" title="توليد الأكواد مغلق حاليًا">تواصل مع إدارة المنصة.</Alert> : null}

      {last ? (
        <Card className="border-success/50 bg-success/5 print:border-0">
          <CardContent className="space-y-3 pt-5 text-center">
            <p className="text-sm text-muted-foreground">كود «{last.title}» — أعطه للتلميذ</p>
            <p dir="ltr" className="select-all font-mono text-4xl font-extrabold tracking-wider tabular-nums">{fmt(last.code)}</p>
            <p className="text-xs text-muted-foreground">يدخل التلميذ حسابه ثم madrasadz.com/claim ويكتب الكود.</p>
            <div className="flex flex-wrap justify-center gap-2 print:hidden">
              <Button asChild>
                <a href={waLink(shareText(last.code, last.title))} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4" /> أرسله عبر واتساب
                </a>
              </Button>
              <Button variant="outline" onClick={() => copy(last.code)}>
                <Copy className="size-4" /> نسخ
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="size-4" /> طباعة
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {summary.stock.length === 0 ? (
        <Alert tone="info" title="لا باقات عندك بعد">تُسجَّل الباقات هنا حين ترسلها إليك إدارة المنصة.</Alert>
      ) : (
        summary.stock.map((line) => (
          <Card key={line.courseId} className="print:hidden">
            <CardContent className="space-y-4 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold leading-snug">{line.courseTitle}</p>
                  <p className="text-sm text-muted-foreground tabular-nums">سعر الباقة: {line.priceDzd} دج</p>
                </div>
                <div className="text-center">
                  <p className={`text-4xl font-extrabold tabular-nums ${line.remaining <= 0 ? 'text-destructive' : ''}`}>{line.remaining}</p>
                  <p className="text-xs text-muted-foreground">باقي عندك</p>
                </div>
              </div>
              <Button className="h-14 w-full text-base" size="lg" disabled={!open || line.remaining <= 0} loading={pending} onClick={() => sell(line)}>
                <ShoppingBag className="size-5" /> بعت باقة — أعطني الكود
              </Button>
            </CardContent>
          </Card>
        ))
      )}

      <Card className="print:hidden">
        <CardContent className="grid grid-cols-2 gap-3 pt-5 text-center text-sm">
          <div>
            <p className="text-2xl font-bold tabular-nums">{summary.soldCount}</p>
            <p className="text-muted-foreground">باقات بعتها</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{summary.activatedCount}</p>
            <p className="text-muted-foreground">فعّلها التلاميذ</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{summary.commissionDzd} دج</p>
            <p className="text-muted-foreground">عمولتك</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{summary.owedDzd} دج</p>
            <p className="text-muted-foreground">المستحق للمنصة</p>
          </div>
        </CardContent>
      </Card>

      <div className="print:hidden">
        {restock.open ? (
          <Card>
            <CardContent className="space-y-3 pt-5">
              <Input type="number" min={1} max={1000} inputMode="numeric" placeholder="كم باقة تحتاج؟" value={restock.qty} onChange={(e) => setRestock({ ...restock, qty: e.target.value })} dir="ltr" />
              <Input placeholder="ملاحظة (اختياري)" maxLength={200} value={restock.note} onChange={(e) => setRestock({ ...restock, note: e.target.value })} />
              <div className="flex gap-2">
                <Button onClick={sendRestock} loading={pending}>
                  إرسال الطلب
                </Button>
                <Button variant="ghost" onClick={() => setRestock({ open: false, qty: '', note: '' })}>
                  تراجع
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button variant="outline" className="w-full" onClick={() => setRestock({ ...restock, open: true })}>
            <PackagePlus className="size-4" /> اطلب باقات جديدة
          </Button>
        )}
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-base">أكوادي</CardTitle>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا أكواد بعد.</p>
          ) : (
            <ul className="divide-y">
              {codes.map((c) => (
                <li key={c.id} className="space-y-2 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span dir="ltr" className="font-mono text-lg font-bold tabular-nums">{c.code ? fmt(c.code) : '—'}</span>
                    <Badge variant={STATUS[c.status].variant}>{STATUS[c.status].label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.courseTitle} · {formatDateTime(new Date(c.createdAt))}
                    {c.soldBy ? ` · ${c.soldBy}` : ''}
                  </p>
                  {c.status === 'ACTIVE' && c.code ? (
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <a href={waLink(shareText(c.code, c.courseTitle))} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="size-4" /> أرسله مرة أخرى
                        </a>
                      </Button>
                      {c.cancellable ? (
                        <Button size="sm" variant="ghost" loading={pending} onClick={() => cancel(c)}>
                          <XCircle className="size-4 text-destructive" /> إلغاء (أُرجعت الباقة)
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
