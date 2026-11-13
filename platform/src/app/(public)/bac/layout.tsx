import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { playBacHiddenHere } from '@/server/services/ios-only.service'

export const dynamic = 'force-dynamic'

/** بنك البكالوريات في تطبيق آيفون وحده ما لم يُظهره المشرف (‎/past-bac و‎/archive يحوّلان إلى هنا) */
export default async function BacLayout({ children }: { children: ReactNode }) {
  const actor = await getCurrentActor()
  if (await playBacHiddenHere(await getDb(), actor?.role)) redirect(actor?.role === 'STUDENT' ? '/student' : '/')
  return children
}
