'use client'

import { Wand2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { requestExercisesAction } from '@/server/actions/ai.actions'

/** زر توليد مسودة تمارين علاجية لمهارة ضعيفة (تظهر في قائمة الاختبارات غير منشورة) */
export function GenerateExercisesButton({ skillId, groupId }: { skillId: string; groupId?: string | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const go = () =>
    start(async () => {
      const r = await requestExercisesAction({ skillId, groupId })
      if (!r.ok) toast('error', r.error.message)
      else {
        toast('success', t('ai.exercisesQueued'))
        router.refresh()
      }
    })
  return (
    <Button type="button" size="sm" variant="outline" onClick={go} loading={pending}>
      <Wand2 className="size-4" /> {t('ai.generateExercises')}
    </Button>
  )
}
