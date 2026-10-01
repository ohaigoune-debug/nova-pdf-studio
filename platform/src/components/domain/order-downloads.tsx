'use client'

import { Download } from 'lucide-react'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { downloadUrlAction } from '@/server/actions/store.actions'

/** زرّ تنزيل ملف رقمي من طلب مؤكَّد: يطلب رابطاً موقّعاً قصير العمر ثم يفتحه */
export function DownloadButton({ orderId, productFileId, name }: { orderId: string; productFileId: string; name: string }) {
  const [pending, start] = useTransition()
  return (
    <Button
      size="sm"
      variant="outline"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await downloadUrlAction(orderId, productFileId)
          if (!r.ok) return toast('error', r.error.message)
          window.open(r.data.url, '_blank', 'noopener')
        })
      }
    >
      <Download className="size-4" /> {name}
    </Button>
  )
}
