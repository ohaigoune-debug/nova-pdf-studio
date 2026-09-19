'use client'

import { Send, Smartphone } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { clearDraft, pickDraftText, queueSubmission, readDraft, writeDraft } from '@/lib/device-store'
import { submitAnswerAction } from '@/server/actions/assignments.actions'

/** محرر إجابة نصية: المسودة تُحفظ على جهاز الطالب، ولا يستقبل الخادم إلا الإجابة النهائية */
export function AnswerEditor({ assignmentId, title, initialText, serverSavedAt = 0 }: { assignmentId: string; title: string; initialText: string; serverSavedAt?: number }) {
  const router = useRouter()
  const [text, setText] = useState(initialText)
  const [savedText, setSavedText] = useState(initialText)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [pending, start] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // المسودة المحفوظة على الجهاز تسبق نص الخادم متى كانت أحدث
  useEffect(() => {
    let alive = true
    const done = (value: string) => {
      if (!alive) return
      setText(value)
      setSavedText(value)
      setLoaded(true)
    }
    readDraft(assignmentId).then(
      (d) => done(pickDraftText(initialText, d, serverSavedAt)),
      () => done(initialText)
    )
    return () => {
      alive = false
    }
  }, [assignmentId, initialText, serverSavedAt])

  useEffect(() => {
    if (!loaded || text === savedText) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setSaving(true)
      try {
        await writeDraft(assignmentId, text)
        setSavedText(text)
      } catch {
        toast('error', t('assignments.deviceSaveFailed'))
      } finally {
        setSaving(false)
      }
    }, 800)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [text, savedText, loaded, assignmentId])

  const queueLocally = useCallback(async () => {
    await queueSubmission(assignmentId, title, text)
    setConfirm(false)
    toast('warning', t('assignments.queuedOffline'), t('assignments.queuedOfflineHint'), 8000)
  }, [assignmentId, title, text])

  const send = () =>
    start(async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        await queueLocally()
        return
      }
      try {
        const r = await submitAnswerAction(assignmentId, text)
        if (!r.ok) {
          toast('error', r.error.message)
          return
        }
        await clearDraft(assignmentId)
        setConfirm(false)
        toast('success', t('common.success'), r.data.late ? t('assignments.late') : undefined)
        router.refresh()
      } catch {
        // انقطاع الشبكة أثناء الإرسال: تبقى الإجابة على الجهاز وتُرسل لاحقاً
        await queueLocally()
      }
    })

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
        <span className="flex items-center gap-1">
          {words} كلمة
          {saving ? (
            <> · {t('assignments.saving')}</>
          ) : text && text === savedText ? (
            <>
              {' · '}
              <Smartphone className="size-3.5" /> {t('assignments.savedOnDevice')}
            </>
          ) : null}
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
            <Button loading={pending} onClick={send}>
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
