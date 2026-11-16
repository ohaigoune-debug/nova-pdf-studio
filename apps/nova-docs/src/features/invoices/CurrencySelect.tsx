/** قائمة اختيار العملة: كل العملات العالمية بأسمائها في لغة الواجهة (أسلوب iOS: عجلة الاختيار الأصلية). */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { intlLocaleOf } from '@shared/settings'
import { usePrefs } from '../../stores/prefs'
import { currencyOptions, ensureCurrency } from '../../lib/worldCurrencies'

export function CurrencySelect({ value, onChange, className }: { value: string; onChange: (code: string) => void; className?: string }) {
  const { t } = useTranslation()
  const locale = intlLocaleOf(usePrefs((s) => s.language))
  const { common, others } = useMemo(() => currencyOptions(locale), [locale])
  const known = common.some((c) => c.code === value) || others.some((c) => c.code === value)
  return (
    <select
      value={value}
      onChange={(e) => {
        ensureCurrency(e.target.value)
        onChange(e.target.value)
      }}
      className={className ?? 'h-12 min-w-0 flex-1 bg-transparent text-[17px] outline-none'}
      dir="ltr"
      aria-label={t('ios.inv.currency')}
    >
      {!known && <option value={value}>{value}</option>}
      <optgroup label={t('ios.inv.currencyCommon')}>
        {common.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
      </optgroup>
      <optgroup label={t('ios.inv.currencyAll')}>
        {others.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
      </optgroup>
    </select>
  )
}
