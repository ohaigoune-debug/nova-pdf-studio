/** محرر الفاتورة على الهاتف: بطاقات بنود مناسبة للّمس، مجاميع حية بالمحرك المالي الصحيح (وحدات صغرى بلا أعداد عشرية). */
import { Plus, Trash2, UserRound, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { calcTotals } from '@modules/invoices/shared/calc'
import { getInvoice, previewNextNumber, saveInvoice } from '@modules/invoices/main/repository'
import { listCustomers, saveCustomer } from '@modules/customers/main/repository'
import { searchProducts } from '@modules/products/main/repository'
import { listTaxes } from '@modules/settings/main/taxes-currencies'
import { getSettings } from '@modules/settings/main/repository'
import { minorToDecimalString, parseMinor, parsePercent, parseQuantity } from '@shared/money'
import { type CustomerSnapshot, customerDisplayName, type InvoiceInput, type Product } from '@shared/invoicing'
import { useNav } from '../../stores/nav'
import { currencyInfo } from '../../lib/invoicing'
import { Button, Field, IconButton, NavBar, Row, SearchField, Section } from '../../ui/kit'
import { Sheet, errorText, toast } from '../../ui/overlays'
import { WithDatabase, addDays, todayIso, useMoney } from './shared'
import { SellerRow, SellerSheet } from './Seller'
import { CurrencySelect } from './CurrencySelect'

interface ItemDraft { key: number; productId: number | null; name: string; qty: string; price: string; discount: string; tax: string }
let keySeq = 0

function toDraft(it: InvoiceInput['items'][number], decimals: number): ItemDraft {
  return { key: ++keySeq, productId: it.productId ?? null, name: it.name, qty: String(it.quantityMilli / 1000), price: minorToDecimalString(it.unitPriceMinor, decimals), discount: String(it.discountBps / 100), tax: String(it.taxBps / 100) }
}

function Editor({ id, prefill }: { id?: number; prefill?: InvoiceInput }) {
  const { t } = useTranslation()
  const { pop, replace } = useNav()
  const money = useMoney()
  const settings = getSettings()
  const existing = id ? getInvoice(id) : null
  const base = (existing ?? prefill ?? null) as (InvoiceInput & { customerSnapshot?: CustomerSnapshot | null }) | null
  const defaultTax = listTaxes().find((x) => x.isDefault)?.rateBps ?? 0
  const [currency, setCurrency] = useState(base?.currency ?? settings.invoice.defaultCurrency)
  const decimals = currencyInfo(currency).decimals
  const [customerId, setCustomerId] = useState<number | null>(base?.customerId ?? null)
  const [snapshot, setSnapshot] = useState<CustomerSnapshot | null>(existing?.customerSnapshot ?? prefill?.customerSnapshot ?? null)
  const [issueDate, setIssueDate] = useState(base?.issueDate ?? todayIso())
  const [dueDate, setDueDate] = useState(base?.dueDate ?? addDays(todayIso(), settings.invoice.defaultDueDays || 30))
  const [notes, setNotes] = useState(base?.notes ?? settings.invoice.defaultNotes ?? '')
  const [shipping, setShipping] = useState(base?.shippingMinor ? minorToDecimalString(base.shippingMinor, decimals) : '')
  const [items, setItems] = useState<ItemDraft[]>(() => (base?.items?.length ? base.items.map((it) => toDraft(it, decimals)) : [{ key: ++keySeq, productId: null, name: '', qty: '1', price: '', discount: '0', tax: String(defaultTax / 100) }]))
  const [pickCustomer, setPickCustomer] = useState(false)
  const [suggestFor, setSuggestFor] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const parsed = useMemo(() => {
    try {
      const lines = items.map((it) => ({ quantityMilli: parseQuantity(it.qty || '0'), unitPriceMinor: parseMinor(it.price || '0', decimals), discountBps: parsePercent(it.discount || '0'), taxBps: parsePercent(it.tax || '0') }))
      return { lines, totals: calcTotals({ lines, shippingMinor: shipping ? parseMinor(shipping, decimals) : 0, paidMinor: existing?.paidMinor ?? 0 }), error: null as string | null }
    } catch (e) {
      return { lines: [], totals: null, error: String((e as Error).message) }
    }
  }, [items, shipping, decimals, existing?.paidMinor])

  const update = (key: number, patch: Partial<ItemDraft>) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)))
  const applyProduct = (key: number, p: Product) => {
    const tax = p.taxId ? listTaxes(true).find((x) => x.id === p.taxId)?.rateBps ?? defaultTax : defaultTax
    update(key, { productId: p.id, name: p.name, price: minorToDecimalString(p.priceMinor, decimals), tax: String(tax / 100) })
    setSuggestFor(null)
  }

  const save = () => {
    if (!parsed.totals) {
      toast(parsed.error ?? t('errors.VALIDATION'), 'error')
      return
    }
    setSaving(true)
    try {
      const saved = saveInvoice({
        id: existing?.id,
        docType: existing?.docType ?? 'invoice',
        number: existing?.number ?? prefill?.number ?? null,
        customerId,
        customerSnapshot: customerId ? null : snapshot,
        issueDate,
        dueDate: dueDate || null,
        currency,
        notes,
        shippingMinor: shipping ? parseMinor(shipping, decimals) : 0,
        status: existing?.status,
        source: prefill?.source ?? existing?.source as InvoiceInput['source'],
        items: items.filter((it) => it.name.trim() || it.price).map((it, i) => ({ productId: it.productId, name: it.name.trim(), quantityMilli: parsed.lines[i].quantityMilli, unitPriceMinor: parsed.lines[i].unitPriceMinor, discountBps: parsed.lines[i].discountBps, taxBps: parsed.lines[i].taxBps }))
      })
      toast(t('ios.inv.saved', { number: saved.number }))
      if (existing) pop()
      else replace({ name: 'invoiceView', id: saved.id })
    } catch (e) {
      toast(errorText(e, t), 'error')
    } finally {
      setSaving(false)
    }
  }

  const customerName = snapshot?.displayName || ''
  const [seller, setSeller] = useState(() => getSettings().company)
  const [sellerOpen, setSellerOpen] = useState(false)
  const [cq, setCq] = useState('')
  const customers = pickCustomer ? listCustomers({ query: cq.trim() || undefined, limit: 50 }) : []

  return (
    <div className="flex h-full flex-col">
      <NavBar title={existing?.number ?? (prefill?.number || previewNextNumber('invoice', issueDate))} onBack={pop} backLabel={t('ios.tabs.invoices')} trailing={<Button size="sm" onClick={save} disabled={saving}>{t('common.save')}</Button>} />
      <div className="ios-scroll min-h-0 flex-1 pt-4 pb-10">
        <Section header={t('ios.inv.seller')}>
          <SellerRow c={seller} onClick={() => setSellerOpen(true)} />
        </Section>
        <Section header={t('ios.inv.customer')}>
          <Row icon={<UserRound className="h-4 w-4" />} title={customerName || t('ios.inv.chooseCustomer')} subtitle={snapshot?.phone} onClick={() => setPickCustomer(true)} chevron
            trailing={customerName ? <button aria-label={t('common.clear')} onClick={(e) => { e.stopPropagation(); setCustomerId(null); setSnapshot(null) }} className="grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-muted"><X className="h-4 w-4" /></button> : undefined} />
        </Section>

        <Section>
          <Field label={t('ios.inv.issueDate')} type="date" value={issueDate} onChange={setIssueDate} dir="ltr" />
          <Field label={t('ios.inv.dueDate')} type="date" value={dueDate ?? ''} onChange={setDueDate} dir="ltr" />
          <label className="flex min-h-[48px] items-center gap-3 px-4">
            <span className="w-[38%] text-[15px] text-muted">{t('ios.inv.currency')}</span>
            <CurrencySelect value={currency} onChange={setCurrency} />
          </label>
        </Section>

        <div className="mx-4 mb-2 flex items-center justify-between px-4 text-[13px] uppercase text-muted"><span>{t('ios.inv.items')}</span></div>
        {items.map((it, i) => {
          const line = parsed.totals?.lines[i]
          const suggestions = suggestFor === it.key && it.name.trim().length > 0 ? searchProducts(it.name.trim(), 5) : []
          return (
            <div key={it.key} className="mx-4 mb-3 rounded-ios bg-surface p-3 shadow-card">
              <div className="flex items-center gap-2">
                <input value={it.name} onChange={(e) => { update(it.key, { name: e.target.value, productId: null }); setSuggestFor(it.key) }} onBlur={() => setTimeout(() => setSuggestFor(null), 200)} placeholder={t('ios.inv.item')} className="h-11 min-w-0 flex-1 rounded-[10px] bg-surface-2 px-3 text-[16px] outline-none" />
                <IconButton label={t('common.delete')} className="text-danger" onClick={() => setItems((l) => (l.length > 1 ? l.filter((x) => x.key !== it.key) : l))}><Trash2 className="h-5 w-5" /></IconButton>
              </div>
              {suggestions.length > 0 && (
                <div className="mt-1 overflow-hidden rounded-[10px] border hairline">
                  {suggestions.map((p) => <button key={p.id} onMouseDown={(e) => e.preventDefault()} onClick={() => applyProduct(it.key, p)} className="flex w-full justify-between px-3 py-2 text-start text-[15px] active:bg-surface-2"><span className="truncate">{p.name}</span><span className="text-muted tabular">{money(p.priceMinor, p.currency)}</span></button>)}
                </div>
              )}
              <div className="mt-2 grid grid-cols-4 gap-2">
                {([['qty', t('ios.inv.qty')], ['price', t('ios.inv.price')], ['discount', t('ios.inv.discount')], ['tax', t('ios.inv.tax')]] as const).map(([k, label]) => (
                  <label key={k} className="flex flex-col">
                    <span className="mb-0.5 truncate text-[11px] text-muted">{label}</span>
                    <input value={it[k]} onChange={(e) => update(it.key, { [k]: e.target.value } as Partial<ItemDraft>)} inputMode="decimal" dir="ltr" className="h-10 w-full rounded-[9px] bg-surface-2 px-2 text-[15px] outline-none tabular" />
                  </label>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[14px]"><span className="text-muted">{t('ios.inv.total')}</span><span className="font-semibold tabular">{line ? money(line.totalMinor, currency) : '—'}</span></div>
            </div>
          )
        })}
        <div className="mx-4 mb-6"><Button variant="tinted" className="w-full" onClick={() => setItems((l) => [...l, { key: ++keySeq, productId: null, name: '', qty: '1', price: '', discount: '0', tax: String(defaultTax / 100) }])}><Plus className="h-5 w-5" />{t('ios.inv.addItem')}</Button></div>

        <Section>
          <Field label={t('ios.inv.shipping')} value={shipping} onChange={setShipping} inputMode="decimal" dir="ltr" placeholder="0" />
          <Field label={t('ios.inv.notes')} value={notes} onChange={setNotes} multiline />
        </Section>

        <Section header={t('inv.editor.totals')}>
          {parsed.totals ? (
            <div className="space-y-1.5 px-4 py-3 text-[15px] tabular">
              <div className="flex justify-between"><span className="text-muted">{t('ios.inv.subtotal')}</span><span>{money(parsed.totals.subtotalMinor, currency)}</span></div>
              {parsed.totals.discountTotalMinor > 0 && <div className="flex justify-between"><span className="text-muted">{t('ios.inv.discountTotal')}</span><span>− {money(parsed.totals.discountTotalMinor, currency)}</span></div>}
              <div className="flex justify-between"><span className="text-muted">{t('ios.inv.taxTotal')}</span><span>{money(parsed.totals.taxTotalMinor, currency)}</span></div>
              {parsed.totals.shippingMinor > 0 && <div className="flex justify-between"><span className="text-muted">{t('ios.inv.shipping')}</span><span>{money(parsed.totals.shippingMinor, currency)}</span></div>}
              <div className="flex justify-between border-t hairline pt-2 text-[19px] font-bold text-brand"><span>{t('ios.inv.total')}</span><span>{money(parsed.totals.grandTotalMinor, currency)}</span></div>
            </div>
          ) : <div className="px-4 py-3 text-danger">{parsed.error}</div>}
        </Section>
      </div>

      <Sheet open={pickCustomer} onClose={() => setPickCustomer(false)} full title={t('ios.inv.chooseCustomer')} trailing={<button className="text-accent" onClick={() => setPickCustomer(false)}>{t('common.cancel')}</button>}>
        <SearchField value={cq} onChange={setCq} placeholder={t('common.search')} autoFocus />
        <Section>
          {cq.trim() && (
            <Row icon={<Plus className="h-4 w-4" />} title={`${t('ios.inv.newCustomer')}: ${cq.trim()}`} onClick={() => {
              const c = saveCustomer({ companyName: cq.trim() })
              setCustomerId(c.id)
              setSnapshot({ id: c.id, displayName: customerDisplayName(c) })
              setPickCustomer(false)
            }} />
          )}
          {customers.map((c) => (
            <Row key={c.id} title={customerDisplayName(c)} subtitle={[c.phone, c.city].filter(Boolean).join(' · ')} onClick={() => {
              setCustomerId(c.id)
              setSnapshot({ id: c.id, displayName: customerDisplayName(c), phone: c.phone, address: c.address, city: c.city })
              setPickCustomer(false)
            }} />
          ))}
        </Section>
      </Sheet>
      {sellerOpen && <SellerSheet open onClose={() => setSellerOpen(false)} onSaved={setSeller} />}
    </div>
  )
}

export default function InvoiceEditor({ id, prefill }: { id?: number; prefill?: unknown }) {
  return <WithDatabase>{() => <Editor id={id} prefill={prefill as InvoiceInput | undefined} />}</WithDatabase>
}
