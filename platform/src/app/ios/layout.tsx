import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { GraduationCap, LogOut } from 'lucide-react'
import { PhoneGate } from '@/components/domain/phone-gate'
import { getLocale } from '@/i18n/server'
import { logoutAction } from '@/server/actions/auth.actions'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { phoneGateFor } from '@/server/services/phone-gate.service'
import { iosLabels } from './labels'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'مدرسة — iPhone', robots: { index: false, follow: false } }

/**
 * Dedicated, public, stable learning-only entry. No UA-based permission or review switch.
 * The native app bar already shows the name, back and the ☰ menu (account, privacy),
 * so the page has no second header: one brand, one sign-in, less repetition.
 */
export default async function IosLearningLayout({ children }: { children: ReactNode }) {
  const [actor, locale] = await Promise.all([getCurrentActor(), getLocale()])
  const text = iosLabels(locale)
  const gate = actor?.role === 'STUDENT' ? await phoneGateFor(await getDb(), actor.userId) : null
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-6 pt-4 sm:px-6">
      <main>
        {actor && actor.role !== 'STUDENT' ? (
          <section role="alert" className="mt-6 space-y-4 rounded-3xl border bg-card p-6 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary" aria-hidden>
              <GraduationCap className="size-7" />
            </span>
            <h1 className="font-display text-2xl font-bold">{text.studentOnlyTitle}</h1>
            <p className="leading-relaxed text-muted-foreground">{text.studentOnlyBody}</p>
            <form action={logoutAction}>
              <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <LogOut className="size-5" aria-hidden />{text.logout}
              </button>
            </form>
          </section>
        ) : gate?.required ? <PhoneGate phone={gate.phone} sms={gate.channels.sms} callNumber={gate.channels.callNumber} /> : children}
      </main>
      <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs leading-relaxed text-muted-foreground">
        <span>{text.mode}</span>
        <Link href="/privacy" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">{text.privacy}</Link>
      </footer>
    </div>
  )
}
