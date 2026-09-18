'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'

/** طباعة الصفحة الحالية إلى PDF عبر المتصفح (يحفظ العربية والاتجاه بشكل صحيح) */
export function PrintButton() {
  return (
    <Button type="button" variant="outline" className="no-print" onClick={() => window.print()}>
      <Printer className="size-4" /> {t('common.exportPdf')}
    </Button>
  )
}
