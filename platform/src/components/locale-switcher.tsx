'use client'

import { Languages } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { LOCALES, type Locale } from '@/i18n'
import { useLocale, useT } from '@/i18n/client'
import { setLocaleAction } from '@/server/actions/locale.actions'

export function LocaleSwitcher() {
  const locale = useLocale()
  const t = useT()
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <label className="inline-flex items-center gap-1 text-xs">
      <Languages className="size-4 text-muted-foreground" aria-hidden />
      <span className="sr-only">{t('common.language')}</span>
      <select
        aria-label={t('common.language')}
        className="h-8 rounded-md border bg-background px-2 text-xs font-semibold"
        value={locale}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            await setLocaleAction(e.target.value as Locale)
            router.refresh()
          })
        }
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  )
}
