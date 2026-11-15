'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { fail, failValidation, ok, runAction, type ActionResult } from '@/server/lib/action-result'
import { isAppError } from '@/server/lib/errors'
import { saveStudentLevelStream } from '@/server/services/student-scope.service'

const schema = z.object({
  levelId: z.string().uuid('اختر المستوى'),
  streamId: z.string().uuid().optional().or(z.literal(''))
})

const FIELD_MSG: Record<string, string> = { levelId: 'اختر المستوى', streamId: 'اختر شعبة من شعب سنتك' }

/** يحفظ التلميذ مستواه وشعبته في حسابه: مرة واحدة من «دروسي»، أو تغييرًا من «حسابي» */
export async function saveMyLevelStreamAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = schema.safeParse({ levelId: form.get('levelId') ?? '', streamId: form.get('streamId') ?? '' })
  if (!parsed.success) return failValidation(parsed.error)
  const actor = await requireActor()
  try {
    await saveStudentLevelStream(await getDb(), actor, { levelId: parsed.data.levelId, streamId: parsed.data.streamId || null })
  } catch (err) {
    // شعبة ناقصة أو ليست من شعب السنة: الخطأ تحت الحقل نفسه؛ غيره برسالته المعتادة
    if (isAppError(err) && err.code === 'VALIDATION' && typeof err.details?.field === 'string') {
      const field = err.details.field
      return fail('VALIDATION', { [field]: FIELD_MSG[field] ?? 'قيمة غير صحيحة' })
    }
    return runAction(() => Promise.reject(err))
  }
  for (const p of ['/student/lessons', '/student/files', '/student/profile', '/student', '/lessons']) revalidatePath(p)
  return ok(undefined)
}
