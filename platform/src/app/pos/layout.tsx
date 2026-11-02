import { LogOut, Store } from 'lucide-react'
import type { ReactNode } from 'react'
import { requirePageActor } from '@/server/auth/current-user'
import { logoutAction } from '@/server/actions/auth.actions'

export const dynamic = 'force-dynamic'

/**
 * واجهة نقطة البيع (مدرسة/مكتبة شريكة): صفحة واحدة بسيطة على الهاتف، بلا قوائم.
 * الحساب لا يرى إلا نقطته (كل خدمة تتحقق من العضوية أيضًا).
 */
export default async function PosLayout({ children }: { children: ReactNode }) {
  const actor = await requirePageActor('POINT_OF_SALE')
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
          <span className="flex items-center gap-2 font-bold">
            <Store className="size-5 text-primary" /> مدرسة — نقطة البيع
          </span>
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden sm:inline">{actor.fullName}</span>
            <form action={logoutAction}>
              <button type="submit" className="flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-semibold hover:bg-muted" aria-label="خروج">
                <LogOut className="size-4" /> خروج
              </button>
            </form>
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-5">{children}</main>
    </div>
  )
}
