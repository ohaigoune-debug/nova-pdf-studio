'use client'

import { Clock, Play } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { startPlaySessionAction } from '@/server/actions/play.actions'
import type { PlayChallengeType } from '@/server/play/constants'

export interface LaunchTarget {
  challengeType: PlayChallengeType
  subjectCode?: string | null
  unitCode?: string | null
  lessonId?: string | null
}

/** زر يبدأ جلسة ويحوّل إليها */
export function StartButton({ target, timed = false, children, className, variant, size, disabled }: { target: LaunchTarget; timed?: boolean; children: React.ReactNode; className?: string; variant?: ButtonProps['variant']; size?: ButtonProps['size']; disabled?: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={disabled}
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await startPlaySessionAction({ ...target, timed })
          if (!r.ok) {
            toast('error', r.error.message)
            return
          }
          router.push(`/student/play/session/${r.data.sessionId}`)
        })
      }
    >
      {children}
    </Button>
  )
}

/** مفتاح الوضع بالمؤقت (يُحفظ محلياً للراحة فقط) */
export function TimedToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)} className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors', value ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground')}>
      <Clock className="size-3.5" /> {value ? 'بالمؤقت: مفعّل' : 'بالمؤقت: معطّل'}
    </button>
  )
}

export function useTimedPref() {
  const [timed, setTimedState] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem('play.timed') === '1'
    } catch {
      return false
    }
  })
  const setTimed = (v: boolean) => {
    setTimedState(v)
    try {
      window.localStorage.setItem('play.timed', v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }
  return [timed, setTimed] as const
}

export function PlayIcon({ className }: { className?: string }) {
  return <Play className={className} />
}
