import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatMoney } from '@shared/money'
import type { InvoiceStatus } from '@shared/invoicing'
import { intlLocaleOf } from '@shared/settings'
import { ensureDatabase } from '../../platform/db'
import { currencyInfo } from '../../lib/invoicing'
import { usePrefs } from '../../stores/prefs'
import { Spinner } from '../../ui/kit'

/** يفتح قاعدة البيانات عند أول استخدام لقسم الفواتير/الجداول ثم يعرض المحتوى. */
export function WithDatabase({ children }: { children: () => React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void ensureDatabase().then(() => setReady(true)).catch((e) => setError(String(e?.message ?? e)))
  }, [])
  if (error) return <div className="p-8 text-center text-danger">{error}</div>
  if (!ready) return <div className="grid h-full place-items-center text-muted"><Spinner /></div>
  return <>{children()}</>
}

export function useMoney() {
  const language = usePrefs((s) => s.language)
  return (minor: number, currency: string) => formatMoney(minor, currencyInfo(currency), { locale: intlLocaleOf(language), numberingSystem: 'latn' })
}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-muted/15 text-muted',
  sent: 'bg-[#2F80ED]/15 text-[#2F80ED]',
  paid: 'bg-accent/15 text-accent',
  partially_paid: 'bg-warning/18 text-[#B7791F]',
  overdue: 'bg-danger/15 text-danger',
  cancelled: 'bg-muted/15 text-muted line-through'
}

export function StatusChip({ status }: { status: InvoiceStatus }) {
  const { t } = useTranslation()
  return <span className={clsx('rounded-full px-2 py-0.5 text-[11.5px] font-semibold', STATUS_COLORS[status])}>{t(`status.${status}`)}</span>
}

export const todayIso = () => new Date().toISOString().slice(0, 10)
export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
