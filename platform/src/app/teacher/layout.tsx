import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { requirePageActor } from '@/server/auth/current-user'

export const dynamic = 'force-dynamic'

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const actor = await requirePageActor('TEACHER')
  return <AppShell actor={actor}>{children}</AppShell>
}
