import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { requirePageActor } from '@/server/auth/current-user'

export const dynamic = 'force-dynamic'

/** بوابة رافع المحتوى: دوراته المسندة فقط (كل خدمة تتحقق من الإسناد أيضًا) */
export default async function StudioLayout({ children }: { children: ReactNode }) {
  const actor = await requirePageActor('CONTENT_UPLOADER')
  return <AppShell actor={actor}>{children}</AppShell>
}
