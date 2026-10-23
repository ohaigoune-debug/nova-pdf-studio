'use client'

import { Check, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { resolvePlayReportAction } from '@/server/actions/play-admin.actions'

/** معالجة/رفض بلاغ مع ملاحظة قرار اختيارية */
export function ReportActions({ id }: { id: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [resolution, setResolution] = useState('')
  const go = (status: 'RESOLVED' | 'DISMISSED') =>
    start(async () => {
      const r = await resolvePlayReportAction({ id, status, resolution })
      if (!r.ok) return toast('error', r.error.message)
      toast('success', status === 'RESOLVED' ? 'عُولج البلاغ' : 'رُفض البلاغ')
      router.refresh()
    })
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <Input value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="ملاحظة القرار (اختيارية)" className="h-9 sm:w-56" />
      <div className="flex gap-1">
        <Button size="sm" variant="success" loading={pending} onClick={() => go('RESOLVED')}>
          <Check className="size-4" /> معالجة
        </Button>
        <Button size="sm" variant="outline" loading={pending} onClick={() => go('DISMISSED')}>
          <X className="size-4" /> رفض
        </Button>
      </div>
    </div>
  )
}
