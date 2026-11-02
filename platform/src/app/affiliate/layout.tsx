import { LogOut, Megaphone } from 'lucide-react'
import type { ReactNode } from 'react'
import { requirePageActor } from '@/server/auth/current-user'
import { logoutAction } from '@/server/actions/auth.actions'

export const dynamic = 'force-dynamic'

/** واجهة المسوّق: صفحة واحدة على الهاتف — كوده، أرباحه، وزبائنه */
export default async function AffiliateLayout({ children }: { children: ReactNode }) {
  const actor = await requirePageActor('AFFILIATE')
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <span className="flex items-center gap-2 font-bold">
            <Megaphone className="size-5 text-primary" /> مدرسة — حساب المسوّق
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
      <main className="mx-auto max-w-2xl px-4 py-5">{children}</main>
    </div>
  )
}
