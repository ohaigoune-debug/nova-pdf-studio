import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { requirePageActor } from '@/server/auth/current-user'

export const dynamic = 'force-dynamic'

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const actor = await requirePageActor('STUDENT')
  return <AppShell actor={actor}>{children}</AppShell>
}
