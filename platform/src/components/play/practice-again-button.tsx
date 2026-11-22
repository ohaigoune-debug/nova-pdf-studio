'use client'

import { useRouter } from 'next/navigation'
import { useTransition, type ReactNode } from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { startLessonPracticeAction } from '@/server/actions/lesson-practice.actions'

/** يبدأ تمرين الدرس (لعبة أو موضوعًا) ويفتحه — تحت الدرس وفي نهاية الجولة («تابع اللعب») */
export function PracticeAgainButton({ linkId, children, className, size, variant }: { linkId: string; children: ReactNode; className?: string; size?: ButtonProps['size']; variant?: ButtonProps['variant'] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button
      className={className}
      size={size}
      variant={variant}
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await startLessonPracticeAction({ linkId })
          if (!r.ok) {
            toast('error', r.error.message)
            return
          }
          router.push(r.data.href)
        })
      }
    >
      {children}
    </Button>
  )
}
