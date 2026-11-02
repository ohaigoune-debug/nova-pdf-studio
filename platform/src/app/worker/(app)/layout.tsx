import { LogOut, PhoneCall } from 'lucide-react'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { WorkerTabs } from '@/components/worker/worker-tabs'
import { logoutAction } from '@/server/actions/auth.actions'
import { getCurrentActor, homeFor } from '@/server/auth/current-user'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'تطبيق التأكيد — مدرسة' }

/**
 * تطبيق عامل التأكيد (قرار المالك 2 نوفمبر 2026): واجهة هاتف واحدة بلا قوائم الإدارة —
 * حجوزاته مع «اتصل» وأزرار النتيجة، و«بحث وتفعيل». يفتحها تطبيق أندرويد الصغير، وتعمل من أي متصفح.
 */
export default async function WorkerLayout({ children }: { children: ReactNode }) {
  const actor = await getCurrentActor()
  if (!actor) redirect('/worker/login')
  if (actor.role !== 'CONFIRMER' && actor.role !== 'SUPER_ADMIN') redirect(homeFor(actor.role))
  return (
    <div className="min-h-dvh bg-background pb-20">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-2.5">
          <span className="flex min-w-0 items-center gap-2 font-bold">
            <PhoneCall className="size-5 shrink-0 text-primary" />
            <span className="truncate">{actor.fullName}</span>
          </span>
          <form action={logoutAction}>
            <button type="submit" className="flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-semibold text-muted-foreground hover:bg-muted" aria-label="خروج">
              <LogOut className="size-4" /> خروج
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-3 py-4">{children}</main>
      <WorkerTabs />
    </div>
  )
}
