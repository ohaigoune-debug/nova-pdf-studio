import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { requirePageActor } from '@/server/auth/current-user'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // كل صفحة داخل الإدارة تفرض دورها أيضًا؛ الموظف مسموح فقط بصفحتي الطلبات والتأكيد.
  const actor = await requirePageActor('SUPER_ADMIN', 'CONFIRMER')
  return <AppShell actor={actor}>{children}</AppShell>
}
