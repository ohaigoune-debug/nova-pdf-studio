'use client'

import { Archive, CheckCircle2, PauseCircle, PlayCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Select, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { archivePlayQuestionAction, setPlayReviewStatusAction, setPlaySuspendedAction } from '@/server/actions/play-admin.actions'
import { PLAY_REVIEW_STATUSES, type PlayReviewStatus } from '@/server/play/constants'
import { STATUS_AR } from './labels'

export function QuestionActions({ id, status, suspended, note }: { id: string; status: string; suspended: boolean; note: string | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [next, setNext] = useState<PlayReviewStatus>((PLAY_REVIEW_STATUSES as readonly string[]).includes(status) ? (status as PlayReviewStatus) : 'NEEDS_REVIEW')
  const [noteText, setNoteText] = useState(note ?? '')
  const [confirmArchive, setConfirmArchive] = useState(false)

  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, okMsg: string, after?: () => void) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) return toast('error', r.error!.message)
      toast('success', okMsg)
      if (after) after()
      router.refresh()
    })

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>حالة المراجعة</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={next} onChange={(e) => setNext(e.target.value as PlayReviewStatus)} className="sm:max-w-xs">
            {PLAY_REVIEW_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_AR[s]}
              </option>
            ))}
          </Select>
          <Button loading={pending} onClick={() => run(() => setPlayReviewStatusAction({ id, status: next, note: noteText }), `صارت الحالة «${STATUS_AR[next]}»`)}>
            <CheckCircle2 className="size-4" /> حفظ الحالة
          </Button>
        </div>
        <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="ملاحظة المراجعة (اختيارية، تُحفظ مع الحالة)" className="min-h-[72px]" />
      </div>

      <div className="flex flex-wrap gap-2">
        {suspended ? (
          <Button variant="success" loading={pending} onClick={() => run(() => setPlaySuspendedAction(id, false), 'أُعيد السؤال إلى العرض')}>
            <PlayCircle className="size-4" /> إلغاء التعليق
          </Button>
        ) : (
          <Button variant="outline" loading={pending} onClick={() => run(() => setPlaySuspendedAction(id, true), 'عُلّق السؤال — لن يُعرض للتلاميذ')}>
            <PauseCircle className="size-4" /> تعليق مؤقت
          </Button>
        )}
        {confirmArchive ? (
          <span className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-sm">
            أرشفة السؤال نهائياً من البنك؟
            <Button size="sm" variant="destructive" loading={pending} onClick={() => run(() => archivePlayQuestionAction(id), 'أُرشف السؤال', () => router.push('/admin/play/questions'))}>
              نعم، أرشف
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmArchive(false)}>
              إلغاء
            </Button>
          </span>
        ) : (
          <Button variant="ghost" className="text-destructive" onClick={() => setConfirmArchive(true)}>
            <Archive className="size-4" /> أرشفة
          </Button>
        )}
      </div>
    </div>
  )
}
