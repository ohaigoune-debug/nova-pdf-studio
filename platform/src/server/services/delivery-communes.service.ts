import { eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { wilayas } from '@/server/db/schema'
import { AppError, assertUuid } from '@/server/lib/errors'
import { ecotrackClient } from './ecotrack.service'

export interface CourseCommune {
  name: string
  hasDesk: boolean
}

export interface CourseCommuneLookup {
  mode: 'select' | 'manual'
  communes: CourseCommune[]
}

/** قائمة بلديات الولاية من الناقل، مع بديل نصّي حين لا تتوفر القائمة. */
export async function courseCommunesForWilaya(db: Db, wilayaId: string, fetchImpl?: typeof fetch): Promise<CourseCommuneLookup> {
  assertUuid(wilayaId, 'VALIDATION')
  const [wilaya] = await db.select({ code: wilayas.code }).from(wilayas).where(eq(wilayas.id, wilayaId)).limit(1)
  if (!wilaya) throw new AppError('VALIDATION', { field: 'wilayaId' })
  const manual: CourseCommuneLookup = { mode: 'manual', communes: [] }
  const client = await ecotrackClient(db, { fetchImpl })
  if (!client) return manual
  try {
    const communes = await client.communesOf(wilaya.code)
    return communes.length ? { mode: 'select', communes } : manual
  } catch {
    // لا نعرض رسالة الناقل الخام أو تفاصيل حسابه للطالب.
    return manual
  }
}
