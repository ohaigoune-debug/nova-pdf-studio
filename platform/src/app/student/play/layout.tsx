import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { isPathHidden } from '@/lib/student-menu'
import { getDb } from '@/server/db/client'
import { studentHiddenPaths } from '@/server/services/ios-only.service'

export const dynamic = 'force-dynamic'

/**
 * حارس PLAY نفسه: تخطيط التلميذ لا يُعاد رسمه حين ينتقل التلميذ داخل حسابه دون إعادة تحميل،
 * فيُفحص هنا أيضًا عند الدخول إلى PLAY من أي رابط (درس، دورة، إشعار).
 */
export default async function PlayLayout({ children }: { children: ReactNode }) {
  if (isPathHidden('/student/play', await studentHiddenPaths(await getDb()))) redirect('/student')
  return children
}
