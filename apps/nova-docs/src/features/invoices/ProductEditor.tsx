import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { deleteProduct, getProduct, saveProduct } from '@modules/products/main/repository'
import { listTaxes } from '@modules/settings/main/taxes-currencies'
import { getSettings } from '@modules/settings/main/repository'
import { minorToDecimalString, parseMinor } from '@shared/money'
import { useNav } from '../../stores/nav'
import { currencyInfo } from '../../lib/invoicing'
import { Button, Field, NavBar, Section } from '../../ui/kit'
import { confirmDialog, errorText, toast } from '../../ui/overlays'
import { WithDatabase } from './shared'
import { CurrencySelect } from './CurrencySelect'

function Form({ id }: { id?: number }) {
  const { t } = useTranslation()
  const pop = useNav((s) => s.pop)
  const existing = id ? getProduct(id) : null
  const [name, setName] = useState(existing?.name ?? '')
  const [sku, setSku] = useState(existing?.sku ?? '')
  const [unit, setUnit] = useState(existing?.unit ?? '')
  const [currency, setCurrency] = useState(existing?.currency ?? getSettings().invoice.defaultCurrency)
  const [price, setPrice] = useState(existing ? minorToDecimalString(existing.priceMinor, currencyInfo(existing.currency).decimals) : '')
  const [taxId, setTaxId] = useState<number | null>(existing?.taxId ?? listTaxes().find((x) => x.isDefault)?.id ?? null)
  const save = () => {
    try {
      saveProduct({ id, name: name.trim(), sku: sku || null, unit, currency, priceMinor: parseMinor(price || '0', currencyInfo(currency).decimals), taxId })
      pop()
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
  }
  return (
    <div className="flex h-full flex-col">
      <NavBar title={id ? name : t('ios.inv.newProduct')} onBack={pop} backLabel={t('ios.inv.products')} trailing={<Button size="sm" onClick={save} disabled={!name.trim()}>{t('common.save')}</Button>} />
      <div className="ios-scroll min-h-0 flex-1 pt-4">
        <Section>
          <Field label={t('common.name')} value={name} onChange={setName} />
          <Field label={t('ios.inv.sku')} value={sku} onChange={setSku} dir="ltr" />
          <Field label={t('ios.inv.unit')} value={unit} onChange={setUnit} />
        </Section>
        <Section>
          <Field label={t('ios.inv.price')} value={price} onChange={setPrice} inputMode="decimal" dir="ltr" />
          <label className="flex min-h-[48px] items-center gap-3 border-b hairline px-4">
            <span className="w-[38%] text-[15px] text-muted">{t('ios.inv.currency')}</span>
            <CurrencySelect value={currency} onChange={setCurrency} />
          </label>
          <label className="flex min-h-[48px] items-center gap-3 px-4">
            <span className="w-[38%] text-[15px] text-muted">{t('ios.inv.tax')}</span>
            <select value={taxId ?? ''} onChange={(e) => setTaxId(e.target.value ? Number(e.target.value) : null)} className="h-12 flex-1 bg-transparent text-[17px] outline-none">
              <option value="">0%</option>
              {listTaxes().map((x) => <option key={x.id} value={x.id}>{x.name} · {x.rateBps / 100}%</option>)}
            </select>
          </label>
        </Section>
        {id && <div className="px-4 pb-10"><Button variant="danger" className="w-full" onClick={async () => { if (await confirmDialog(t('common.delete'), { destructive: true })) { deleteProduct(id); pop() } }}>{t('common.delete')}</Button></div>}
      </div>
    </div>
  )
}

export default function ProductEditor({ id }: { id?: number }) {
  return <WithDatabase>{() => <Form id={id} />}</WithDatabase>
}
