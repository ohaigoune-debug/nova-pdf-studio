/** بيانات البائع (صاحب الفاتورة) — تُحفظ في الإعدادات (settings.company) وتُطبع في كل فاتورة. */
import { Store } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CompanyProfile } from '@shared/settings'
import { getSettings, updateSettings } from '@modules/settings/main/repository'
import { Button, Field, Row, Section } from '../../ui/kit'
import { Sheet, toast } from '../../ui/overlays'

export function SellerFields({ c, set }: { c: CompanyProfile; set: (k: keyof CompanyProfile) => (v: string) => void }) {
  const { t } = useTranslation()
  return (
    <>
      <Section>
        <Field label={t('settings.company.name')} value={c.name} onChange={set('name')} />
        <Field label={t('settings.company.firstName')} value={c.firstName} onChange={set('firstName')} />
        <Field label={t('settings.company.lastName')} value={c.lastName} onChange={set('lastName')} />
        <Field label={t('settings.company.address')} value={c.address} onChange={set('address')} />
        <Field label={t('settings.company.city')} value={c.city} onChange={set('city')} />
        <Field label={t('settings.company.phone')} value={c.phone} onChange={set('phone')} dir="ltr" inputMode="tel" />
        <Field label={t('settings.company.email')} value={c.email} onChange={set('email')} dir="ltr" inputMode="email" />
      </Section>
      <Section>
        <Field label={t('settings.company.rc')} value={c.rc} onChange={set('rc')} dir="ltr" />
        <Field label={t('settings.company.nif')} value={c.nif} onChange={set('nif')} dir="ltr" />
        <Field label={t('settings.company.nis')} value={c.nis} onChange={set('nis')} dir="ltr" />
        <Field label={t('settings.company.ai')} value={c.ai} onChange={set('ai')} dir="ltr" />
        <Field label={t('settings.company.iban')} value={c.iban} onChange={set('iban')} dir="ltr" />
      </Section>
    </>
  )
}

export function sellerTitle(c: CompanyProfile): string {
  return c.name.trim() || `${c.firstName} ${c.lastName}`.trim()
}

export function isSellerMissing(c: CompanyProfile = getSettings().company): boolean {
  return !sellerTitle(c)
}

/** ورقة منبثقة لتعديل بيانات البائع دون مغادرة الشاشة (فلا تضيع مسودة الفاتورة). */
export function SellerSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved?: (c: CompanyProfile) => void }) {
  const { t } = useTranslation()
  const [c, setC] = useState<CompanyProfile>(() => getSettings().company)
  const set = (k: keyof CompanyProfile) => (v: string) => setC((s) => ({ ...s, [k]: v }))
  const save = () => {
    updateSettings({ company: c })
    toast(t('ios.viewer.saved'))
    onSaved?.(c)
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} full title={t('ios.inv.seller')} trailing={<button className="text-accent" onClick={onClose}>{t('common.cancel')}</button>}
      footer={<Button size="lg" className="w-full" onClick={save}>{t('common.save')}</Button>}>
      <p className="px-6 pb-4 text-center text-[14px] text-muted">{t('ios.inv.sellerHint')}</p>
      <SellerFields c={c} set={set} />
    </Sheet>
  )
}

/** سطر «البائع» في محرر الفاتورة وفي شاشة الفواتير. */
export function SellerRow({ c, onClick }: { c: CompanyProfile; onClick: () => void }) {
  const { t } = useTranslation()
  const title = sellerTitle(c)
  const sub = [c.phone, c.nif && `NIF ${c.nif}`].filter(Boolean).join(' · ')
  return (
    <Row icon={<Store className="h-4 w-4" />} iconBg="bg-[#123D36]" title={title || t('ios.inv.sellerAdd')} subtitle={title ? sub || undefined : t('ios.inv.sellerMissing')} onClick={onClick} chevron />
  )
}
