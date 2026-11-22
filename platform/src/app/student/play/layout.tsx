import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { isPathHidden } from '@/lib/student-menu'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { studentHiddenPaths } from '@/server/services/ios-only.service'
import { isOwnPracticeRunPath } from '@/server/services/lesson-practice.service'

export const dynamic = 'force-dynamic'

/**
 * حارس PLAY نفسه: تخطيط التلميذ لا يُعاد رسمه حين ينتقل التلميذ داخل حسابه دون إعادة تحميل،
 * فيُفحص هنا أيضًا عند الدخول إلى PLAY من أي رابط (درس، دورة، إشعار).
 * الاستثناء الوحيد: جولة/محاولة تمرين من تحت درس الدورة (practiceLinkId) لصاحبها.
 */
export default async function PlayLayout({ children }: { children: ReactNode }) {
  const db = await getDb()
  if (isPathHidden('/student/play', await studentHiddenPaths(db))) {
    // تمرين بدأ من تحت درس الدورة (22 نوفمبر 2026): جولته ومحاولته مفتوحتان لصاحبهما ولو أُخفي PLAY
    const path = (await headers()).get('x-pathname') ?? ''
    const actor = await getCurrentActor()
    if (!(actor && (await isOwnPracticeRunPath(db, actor, path)))) redirect('/student')
  }
  return children
}
