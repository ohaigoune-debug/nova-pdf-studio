'use client'

import { Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { cn, formatDateTime } from '@/lib/utils'
import { addThreadMessageAction } from '@/server/actions/assignments.actions'
import type { ThreadMessage } from '@/server/services/assignments.service'

const kindLabel: Record<string, string> = {
  ANSWER: t('assignments.answerKindAnswer'),
  FEEDBACK: t('assignments.answerKindFeedback'),
  REPLY: t('assignments.answerKindReply'),
  SYSTEM: t('assignments.answerKindSystem')
}

export function SubmissionThread({ submissionId, messages, canReply, placeholder }: { submissionId: string; messages: ThreadMessage[]; canReply: boolean; placeholder: string }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [pending, start] = useTransition()
  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {messages.map((m) => (
          <li key={m.id} className={cn('flex', m.mine ? 'justify-start' : 'justify-end')}>
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm',
                m.kind === 'ANSWER' && 'border bg-card',
                m.kind === 'FEEDBACK' && 'bg-primary/10 border border-primary/20',
                m.kind === 'REPLY' && 'bg-muted',
                m.kind === 'SYSTEM' && 'bg-muted text-muted-foreground'
              )}
            >
              <p className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="font-bold text-foreground">{m.authorName}</span>
                <span>· {kindLabel[m.kind] ?? m.kind}</span>
                <span className="tabular">· {formatDateTime(m.createdAt)}</span>
              </p>
              <p className="whitespace-pre-wrap leading-7">{m.body}</p>
            </div>
          </li>
        ))}
      </ol>
      {canReply ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!text.trim()) return
            start(async () => {
              const r = await addThreadMessageAction(submissionId, text)
              if (!r.ok) toast('error', r.error.message)
              else {
                setText('')
                router.refresh()
              }
            })
          }}
          className="flex items-end gap-2"
        >
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} rows={2} className="flex-1" />
          <Button type="submit" loading={pending} disabled={!text.trim()}>
            <Send className="size-4" /> {t('assignments.send')}
          </Button>
        </form>
      ) : null}
    </div>
  )
}
