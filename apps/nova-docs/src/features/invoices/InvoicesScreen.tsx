/** قسم «الفواتير»: الفواتير والعملاء والمنتجات فوق مستودعات نسخة Windows نفسها (SQLite على الجهاز). */
import { FileInput, Package, Plus, ReceiptText, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listInvoices } from '@modules/invoices/main/repository'
import { listCustomers } from '@modules/customers/main/repository'
import { listProducts } from '@modules/products/main/repository'
import { getSettings } from '@modules/settings/main/repository'
import { customerDisplayName } from '@shared/invoicing'
import type { CustomerSummary, InvoiceListRow, Product } from '@shared/invoicing'
import { useNav } from '../../stores/nav'
import { usePro } from '../../stores/proInstance'
import { extractInvoiceFromPdf } from '../../lib/invoicing'
import { pickFilesBytes } from '../../lib/docs'
import { Button, Empty, IconButton, NavBar, SearchField, Segmented } from '../../ui/kit'
import { ActionSheet, errorText, toast } from '../../ui/overlays'
import { StatusChip, WithDatabase, useMoney } from './shared'

type Seg = 'invoices' | 'customers' | 'products'

function Lists() {
  const { t } = useTranslation()
  const push = useNav((s) => s.push)
  const money = useMoney()
  const [seg, setSeg] = useState<Seg>('invoices')
  const [query, setQuery] = useState('')
  const [invoices, setInvoices] = useState<InvoiceListRow[]>([])
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [menu, setMenu] = useState(false)
  const stackDepth = useNav((s) => s.stacks.invoices.length)

  useEffect(() => {
    const q = query.trim() || undefined
    setInvoices(listInvoices({ query: q, limit: 300, sort: 'date_desc' }).rows)
    setCustomers(listCustomers({ query: q }))
    setProducts(listProducts({ query: q }))
  }, [query, seg, stackDepth])

  const importPdf = async () => {
    if (!usePro.getState().require('invoices')) return
    try {
      const [file] = await pickFilesBytes(['pdf'], false)
      if (!file) return
      const res = await extractInvoiceFromPdf(file.bytes, getSettings().invoice.defaultCurrency)
      if (!res.found && !res.input.number) {
        toast(t('ios.inv.importNothing'), 'info')
        return
      }
      toast(t('ios.inv.importFound', { items: res.found, total: res.totalMinor !== null ? money(res.totalMinor, res.input.currency) : '—' }), 'info')
      push({ name: 'invoiceEdit', prefill: res.input })
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
  }

  const add = () => {
    if (!usePro.getState().require('invoices')) return
    if (seg === 'invoices') push({ name: 'invoiceEdit' })
    else if (seg === 'customers') push({ name: 'customerEdit' })
    else push({ name: 'productEdit' })
  }

  return (
    <div className="ios-scroll h-full">
      <NavBar
        title={t('ios.tabs.invoices')}
        large
        trailing={
          <>
            <IconButton label={t('ios.inv.importPdf')} onClick={() => setMenu(true)}><FileInput className="h-[22px] w-[22px]" /></IconButton>
            <IconButton label={t('common.add')} onClick={add}><Plus className="h-6 w-6" /></IconButton>
          </>
        }
      >
        <div className="px-4 pb-2"><Segmented value={seg} onChange={setSeg} options={[{ value: 'invoices', label: t('ios.inv.invoices') }, { value: 'customers', label: t('ios.inv.customers') }, { value: 'products', label: t('ios.inv.products') }]} /></div>
        <SearchField value={query} onChange={setQuery} placeholder={t('common.search')} />
      </NavBar>

      {seg === 'invoices' && (invoices.length === 0 ? (
        <Empty icon={<ReceiptText className="h-10 w-10" />} title={t('ios.inv.emptyInvoices')} desc={t('ios.inv.emptyInvoicesDesc')} action={<Button onClick={add}><Plus className="h-5 w-5" />{t('ios.inv.newInvoice')}</Button>} />
      ) : (
        <ul className="mx-4 mt-2 overflow-hidden rounded-ios bg-surface">
          {invoices.map((r) => (
            <li key={r.id}>
              <button onClick={() => push({ name: 'invoiceView', id: r.id })} className="pressable flex w-full items-center gap-3 border-b hairline px-4 py-3 text-start">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><span className="truncate text-[16px] font-semibold tabular">{r.number}</span><StatusChip status={r.status} /></span>
                  <span className="block truncate text-[14px] text-muted">{r.customerName || '—'} · {r.issueDate}</span>
                </span>
                <span className="text-end">
                  <span className="block text-[16px] font-semibold tabular">{money(r.grandTotalMinor, r.currency)}</span>
                  {r.remainingMinor > 0 && r.status !== 'draft' && r.status !== 'cancelled' && <span className="block text-[12px] text-danger tabular">{t('ios.inv.remaining')}: {money(r.remainingMinor, r.currency)}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ))}

      {seg === 'customers' && (customers.length === 0 ? (
        <Empty icon={<Users className="h-10 w-10" />} title={t('ios.inv.emptyCustomers')} action={<Button onClick={add}><Plus className="h-5 w-5" />{t('ios.inv.newCustomer')}</Button>} />
      ) : (
        <ul className="mx-4 mt-2 overflow-hidden rounded-ios bg-surface">
          {customers.map((c) => (
            <li key={c.id}>
              <button onClick={() => push({ name: 'customerEdit', id: c.id })} className="pressable flex w-full items-center gap-3 border-b hairline px-4 py-3 text-start">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/15 text-[16px] font-bold text-accent">{customerDisplayName(c).slice(0, 1)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-medium">{customerDisplayName(c)}</span>
                  <span className="block truncate text-[13px] text-muted">{[c.phone, c.city].filter(Boolean).join(' · ') || '—'}</span>
                </span>
                {c.remainingMinor > 0 && <span className="text-[13px] font-semibold text-danger tabular">{money(c.remainingMinor, getSettings().invoice.defaultCurrency)}</span>}
              </button>
            </li>
          ))}
        </ul>
      ))}

      {seg === 'products' && (products.length === 0 ? (
        <Empty icon={<Package className="h-10 w-10" />} title={t('ios.inv.emptyProducts')} action={<Button onClick={add}><Plus className="h-5 w-5" />{t('ios.inv.newProduct')}</Button>} />
      ) : (
        <ul className="mx-4 mt-2 overflow-hidden rounded-ios bg-surface">
          {products.map((p) => (
            <li key={p.id}>
              <button onClick={() => push({ name: 'productEdit', id: p.id })} className="pressable flex w-full items-center gap-3 border-b hairline px-4 py-3 text-start">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-medium">{p.name}</span>
                  <span className="block truncate text-[13px] text-muted">{[p.sku, p.category, p.unit].filter(Boolean).join(' · ') || '—'}</span>
                </span>
                <span className="text-[15px] font-semibold tabular">{money(p.priceMinor, p.currency)}</span>
              </button>
            </li>
          ))}
        </ul>
      ))}
      <div className="h-10" />
      <ActionSheet open={menu} onClose={() => setMenu(false)} actions={[
        { label: t('ios.inv.importPdf'), icon: <FileInput className="h-5 w-5" />, pro: !usePro.getState().isPro, onSelect: () => void importPdf() },
        { label: t('ios.inv.newInvoice'), icon: <ReceiptText className="h-5 w-5" />, onSelect: () => (usePro.getState().require('invoices') ? push({ name: 'invoiceEdit' }) : undefined) }
      ]} />
    </div>
  )
}

export default function InvoicesScreen() {
  return <WithDatabase>{() => <Lists />}</WithDatabase>
}
