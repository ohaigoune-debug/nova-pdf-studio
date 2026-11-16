/** تفاصيل الفاتورة: معاينة القالب الحقيقي، تصدير PDF (WebKit أصلي)، طباعة، مشاركة، مدفوعات جزئية، تغيير الحالة. */
import { Banknote, Copy, FileDown, Pencil, Printer, Send, Share2, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addPayment, deletePayment, duplicateInvoice, getInvoice, setInvoiceStatus, trashInvoice } from '@modules/invoices/main/repository'
import { pageSizeMm } from '@shared/templates'
import { getDefaultTemplate } from '@modules/templates/main/repository'
import { parseMinor, minorToDecimalString } from '@shared/money'
import { PAYMENT_METHODS } from '@shared/invoicing'
import { useNav } from '../../stores/nav'
import { usePrefs } from '../../stores/prefs'
import { useLibrary } from '../../stores/library'
import { currencyInfo, invoiceHtml, invoicePdf } from '../../lib/invoicing'
import { printBytes, shareBytes } from '../../lib/docs'
import { writeLibraryFile } from '../../platform/library'
import { Button, Field, IconButton, NavBar, Row, Section, Spinner, useElementWidth } from '../../ui/kit'
import { ActionSheet, Sheet, confirmDialog, errorText, toast } from '../../ui/overlays'
import { StatusChip, WithDatabase, todayIso, useMoney } from './shared'

function View({ id }: { id: number }) {
  const { t } = useTranslation()
  const { pop, push, replace } = useNav()
  const language = usePrefs((s) => s.language)
  const money = useMoney()
  const [tick, setTick] = useState(0)
  const invoice = useMemo(() => getInvoice(id), [id, tick])
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [busy, setBusy] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [paidAt, setPaidAt] = useState(todayIso())
  const [method, setMethod] = useState<string>('cash')
  if (!invoice) return <div className="p-8 text-center text-muted">—</div>
  const html = invoiceHtml(invoice, language)
  const page = pageSizeMm(getDefaultTemplate().definition.page)
  const pxW = (page.width / 25.4) * 96
  const pxH = (page.height / 25.4) * 96
  const scale = width ? Math.min(1, (width - 32) / pxW) : 0.4

  const withPdf = async (label: string, fn: (pdf: { name: string; bytes: Uint8Array }) => Promise<void>) => {
    setBusy(label)
    try {
      await fn(await invoicePdf(invoice, language))
    } catch (e) {
      toast(errorText(e, t), 'error')
    } finally {
      setBusy(null)
    }
  }

  const pay = () => {
    try {
      addPayment({ invoiceId: invoice.id, paidAt, amountMinor: parseMinor(amount, currencyInfo(invoice.currency).decimals), method })
      setPayOpen(false)
      setTick((x) => x + 1)
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
  }

  return (
    <div className="flex h-full flex-col">
      <NavBar title={invoice.number} onBack={pop} backLabel={t('ios.tabs.invoices')} trailing={<>
        <IconButton label={t('ios.inv.edit')} onClick={() => push({ name: 'invoiceEdit', id: invoice.id })}><Pencil className="h-5 w-5" /></IconButton>
        <IconButton label={t('ios.common.more')} onClick={() => setMenu(true)}><Share2 className="h-5 w-5" /></IconButton>
      </>} />
      <div ref={ref} className="ios-scroll min-h-0 flex-1 pb-10">
        <div className="mx-4 mt-4 flex items-center justify-between rounded-ios bg-surface p-4">
          <div>
            <div className="text-[13px] text-muted">{invoice.customerSnapshot.displayName || '—'}</div>
            <div className="text-[26px] font-bold text-brand tabular">{money(invoice.grandTotalMinor, invoice.currency)}</div>
            {invoice.paidMinor > 0 && <div className="text-[13px] text-muted tabular">{t('ios.inv.paid')}: {money(invoice.paidMinor, invoice.currency)} · {t('ios.inv.remaining')}: {money(invoice.remainingMinor, invoice.currency)}</div>}
          </div>
          <StatusChip status={invoice.status} />
        </div>

        <div className="mx-4 mt-3 grid grid-cols-3 gap-2">
          <Button variant="tinted" size="sm" disabled={!!busy} onClick={() => void withPdf('share', (p) => shareBytes(p.name, p.bytes))}>{busy === 'share' ? <Spinner /> : <FileDown className="h-4 w-4" />}{t('ios.inv.exportPdf')}</Button>
          <Button variant="tinted" size="sm" disabled={!!busy} onClick={() => void withPdf('print', (p) => printBytes(p.name, p.bytes))}>{busy === 'print' ? <Spinner /> : <Printer className="h-4 w-4" />}{t('ios.common.print')}</Button>
          <Button variant="tinted" size="sm" onClick={() => { setAmount(minorToDecimalString(invoice.remainingMinor, currencyInfo(invoice.currency).decimals)); setPayOpen(true) }} disabled={invoice.remainingMinor <= 0 || invoice.status === 'cancelled'}><Banknote className="h-4 w-4" />{t('ios.inv.addPayment')}</Button>
        </div>

        <div className="mt-4 flex justify-center" style={{ height: pxH * scale + 8 }}>
          <div className="pdf-page overflow-hidden" style={{ width: pxW * scale, height: pxH * scale }}>
            <iframe title={invoice.number} srcDoc={html} sandbox="" className="origin-top-left border-0 bg-white rtl:origin-top-right" style={{ width: pxW, height: pxH, transform: `scale(${scale})` }} />
          </div>
        </div>

        {invoice.payments.length > 0 && (
          <Section header={t('ios.inv.payments')} className="mt-6">
            {invoice.payments.map((p) => (
              <Row key={p.id} title={money(p.amountMinor, invoice.currency)} subtitle={`${p.paidAt} · ${t(`inv.editor.methods.${p.method}`, { defaultValue: p.method })}`}
                trailing={<IconButton label={t('common.delete')} className="text-danger" onClick={async () => { if (await confirmDialog(t('common.delete'), { destructive: true })) { deletePayment(p.id); setTick((x) => x + 1) } }}><Trash2 className="h-4 w-4" /></IconButton>} />
            ))}
          </Section>
        )}
      </div>

      <ActionSheet open={menu} onClose={() => setMenu(false)} title={invoice.number} actions={[
        { label: t('ios.common.share'), icon: <Share2 className="h-5 w-5" />, onSelect: () => void withPdf('share', (p) => shareBytes(p.name, p.bytes)) },
        { label: t('ios.docs.title'), icon: <FileDown className="h-5 w-5" />, onSelect: () => void withPdf('lib', async (p) => { const n = await writeLibraryFile(p.name, p.bytes); await useLibrary.getState().refresh(); toast(t('ios.tools.resultSaved', { name: n })) }) },
        { label: t('ios.inv.markSent'), icon: <Send className="h-5 w-5" />, hidden: invoice.status !== 'draft', onSelect: () => { setInvoiceStatus(invoice.id, 'sent'); setTick((x) => x + 1) } },
        { label: t('ios.inv.markPaid'), icon: <Banknote className="h-5 w-5" />, hidden: invoice.remainingMinor <= 0 || invoice.status === 'cancelled', onSelect: () => { addPayment({ invoiceId: invoice.id, paidAt: todayIso(), amountMinor: invoice.remainingMinor, method: 'cash' }); setTick((x) => x + 1) } },
        { label: t('ios.inv.duplicate'), icon: <Copy className="h-5 w-5" />, onSelect: () => { const d = duplicateInvoice(invoice.id); replace({ name: 'invoiceView', id: d.id }) } },
        { label: t('common.delete'), icon: <Trash2 className="h-5 w-5" />, destructive: true, onSelect: async () => { if (await confirmDialog(t('ios.inv.confirmDelete', { number: invoice.number }), { destructive: true })) { trashInvoice(invoice.id); pop() } } }
      ]} />

      <Sheet open={payOpen} onClose={() => setPayOpen(false)} title={t('ios.inv.addPayment')} trailing={<button className="font-semibold text-accent" onClick={pay}>{t('common.save')}</button>}>
        <Section>
          <Field label={t('ios.inv.amount')} value={amount} onChange={setAmount} inputMode="decimal" dir="ltr" />
          <Field label={t('ios.common.today')} type="date" value={paidAt} onChange={setPaidAt} dir="ltr" />
          <label className="flex min-h-[48px] items-center gap-3 px-4">
            <span className="w-[38%] text-[15px] text-muted">{t('ios.inv.method')}</span>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="h-12 flex-1 bg-transparent text-[17px] outline-none">
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{t(`inv.editor.methods.${m}`, { defaultValue: m })}</option>)}
            </select>
          </label>
        </Section>
      </Sheet>
    </div>
  )
}

export default function InvoiceView({ id }: { id: number }) {
  return <WithDatabase>{() => <View id={id} />}</WithDatabase>
}
