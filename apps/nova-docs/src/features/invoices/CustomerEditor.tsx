import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { deleteCustomer, getCustomer, saveCustomer } from '@modules/customers/main/repository'
import type { CustomerInput } from '@shared/invoicing'
import { useNav } from '../../stores/nav'
import { Button, Field, NavBar, Section } from '../../ui/kit'
import { confirmDialog, errorText, toast } from '../../ui/overlays'
import { WithDatabase, useMoney } from './shared'
import { getSettings } from '@modules/settings/main/repository'

function Form({ id }: { id?: number }) {
  const { t } = useTranslation()
  const pop = useNav((s) => s.pop)
  const money = useMoney()
  const existing = id ? getCustomer(id) : null
  const [v, setV] = useState<CustomerInput>(existing ?? { companyName: '', firstName: '', lastName: '', phone: '', email: '', address: '', city: '', taxId: '' })
  const f = (k: keyof CustomerInput) => (val: string) => setV((s) => ({ ...s, [k]: val }))
  const save = () => {
    try {
      saveCustomer({ ...v, id })
      pop()
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
  }
  return (
    <div className="flex h-full flex-col">
      <NavBar title={id ? v.companyName || `${v.firstName} ${v.lastName}` : t('ios.inv.newCustomer')} onBack={pop} backLabel={t('ios.inv.customers')} trailing={<Button size="sm" onClick={save}>{t('common.save')}</Button>} />
      <div className="ios-scroll min-h-0 flex-1 pt-4">
        {existing && existing.invoicesCount > 0 && (
          <div className="mx-4 mb-4 grid grid-cols-3 gap-2 text-center">
            {[[t('ios.inv.total'), existing.totalInvoicedMinor], [t('ios.inv.paid'), existing.paidMinor], [t('ios.inv.remaining'), existing.remainingMinor]].map(([label, val]) => (
              <div key={String(label)} className="rounded-ios bg-surface p-3"><div className="text-[12px] text-muted">{label}</div><div className="text-[15px] font-semibold tabular">{money(Number(val), getSettings().invoice.defaultCurrency)}</div></div>
            ))}
          </div>
        )}
        <Section>
          <Field label={t('ios.inv.companyName')} value={v.companyName ?? ''} onChange={f('companyName')} />
          <Field label={t('ios.inv.firstName')} value={v.firstName ?? ''} onChange={f('firstName')} />
          <Field label={t('ios.inv.lastName')} value={v.lastName ?? ''} onChange={f('lastName')} />
        </Section>
        <Section>
          <Field label={t('ios.inv.phone')} value={v.phone ?? ''} onChange={f('phone')} type="tel" inputMode="tel" dir="ltr" />
          <Field label={t('ios.inv.email')} value={v.email ?? ''} onChange={f('email')} type="email" inputMode="email" dir="ltr" />
          <Field label={t('ios.inv.address')} value={v.address ?? ''} onChange={f('address')} />
          <Field label={t('ios.inv.city')} value={v.city ?? ''} onChange={f('city')} />
          <Field label={t('ios.inv.taxId')} value={v.taxId ?? ''} onChange={f('taxId')} dir="ltr" />
        </Section>
        {id && <div className="px-4 pb-10"><Button variant="danger" className="w-full" onClick={async () => { if (await confirmDialog(t('common.delete'), { destructive: true })) { deleteCustomer(id); pop() } }}>{t('common.delete')}</Button></div>}
      </div>
    </div>
  )
}

export default function CustomerEditor({ id }: { id?: number }) {
  return <WithDatabase>{() => <Form id={id} />}</WithDatabase>
}
