import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { requirePageActor } from '@/server/auth/current-user'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // كل صفحة داخل الإدارة تفرض دورها أيضًا؛ موظف التأكيد للطلبات فقط، ومدير العمليات لنقاط البيع وإشعاراته.
  const actor = await requirePageActor('SUPER_ADMIN', 'CONFIRMER', 'MANAGER')
  return <AppShell actor={actor}>{children}</AppShell>
}
