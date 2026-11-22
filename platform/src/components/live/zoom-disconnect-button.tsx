'use client'

import { Unplug } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { disconnectZoomAction } from '@/server/actions/live.actions'

export function ZoomDisconnectButton() {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={pending}
      onClick={() => {
        if (!confirm('فصل حساب Zoom؟ لن تستطيع بدء الحصص من المنصة حتى تربطه من جديد.')) return
        start(async () => {
          const r = await disconnectZoomAction()
          if (!r.ok) toast('error', r.error.message)
          else {
            toast('success', 'فُصل حساب Zoom')
            router.refresh()
          }
        })
      }}
    >
      <Unplug className="size-4" /> فصل
    </Button>
  )
}
