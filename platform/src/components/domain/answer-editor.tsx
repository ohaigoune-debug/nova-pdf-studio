'use client'

import { Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { saveDraftAction, submitAnswerAction } from '@/server/actions/assignments.actions'

/** محرر إجابة نصية كرسالة: حفظ مسودة تلقائي، ثم إرسال نهائي بتأكيد */
export function AnswerEditor({ assignmentId, initialText }: { assignmentId: string; initialText: string }) {
  const router = useRouter()
  const [text, setText] = useState(initialText)
  const [savedText, setSavedText] = useState(initialText)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [pending, start] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (text === savedText) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setSaving(true)
      const r = await saveDraftAction(assignmentId, text)
      setSaving(false)
      if (r.ok) setSavedText(text)
      else toast('error', r.error.message)
    }, 1500)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [text, savedText, assignmentId])

  const words = text.trim() ? text.trim().split(/\s+/).length : 0

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('assignments.answerPlaceholder')}
        rows={12}
        className="w-full rounded-lg border bg-background p-4 text-[16px] leading-8 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        dir="rtl"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {words} كلمة · {saving ? t('assignments.saving') : text === savedText && text ? t('assignments.draftSaved') : ''}
        </span>
        <Button onClick={() => setConfirm(true)} disabled={text.trim().length < 3 || pending} loading={pending}>
          <Send className="size-4" /> {t('assignments.submit')}
        </Button>
      </div>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('assignments.submit')}</DialogTitle>
            <DialogDescription>{t('assignments.submitConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await submitAnswerAction(assignmentId, text)
                  if (!r.ok) toast('error', r.error.message)
                  else {
                    toast('success', t('common.success'), r.data.late ? t('assignments.late') : undefined)
                    setConfirm(false)
                    router.refresh()
                  }
                })
              }
            >
              {t('common.confirm')}
            </Button>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
