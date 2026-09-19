'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { clearDraft, dequeue, listQueued, recordFailure } from '@/lib/device-store'
import { submitAnswerAction } from '@/server/actions/assignments.actions'

/** يُفرغ طابور الجهاز: الإجابات التي كُتبت بلا اتصال تُرسل تلقائياً عند عودة الشبكة */
export function OutboxSync() {
  const router = useRouter()
  const busy = useRef(false)

  const flush = useCallback(async () => {
    if (busy.current || (typeof navigator !== 'undefined' && navigator.onLine === false)) return
    busy.current = true
    let sent = 0
    try {
      for (const entry of await listQueued()) {
        let result
        try {
          result = await submitAnswerAction(entry.assignmentId, entry.text)
        } catch {
          break // سقطت الشبكة مجدداً: نُبقي الباقي في الطابور
        }
        if (result.ok) {
          await dequeue(entry.assignmentId)
          await clearDraft(entry.assignmentId)
          sent++
        } else {
          const { dropped } = await recordFailure(entry.assignmentId)
          toast('error', entry.title, dropped ? t('assignments.outboxDropped') : result.error.message, 8000)
        }
      }
    } finally {
      busy.current = false
    }
    if (sent) {
      toast('success', t('assignments.outboxSent', { n: sent }))
      router.refresh()
    }
  }, [router])

  useEffect(() => {
    void flush()
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [flush])

  return null
}
