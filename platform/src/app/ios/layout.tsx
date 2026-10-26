import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { PhoneGate } from '@/components/domain/phone-gate'
import { getLocale } from '@/i18n/server'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { phoneGateFor } from '@/server/services/phone-gate.service'
import { iosLabels } from './labels'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'مدرسة — iPhone', robots: { index: false, follow: false } }

/** Dedicated, public, stable learning-only entry. No UA-based permission or review switch. */
export default async function IosLearningLayout({ children }: { children: ReactNode }) {
  const [actor, locale] = await Promise.all([getCurrentActor(), getLocale()])
  const text = iosLabels(locale)
  const gate = actor?.role === 'STUDENT' ? await phoneGateFor(await getDb(), actor.userId) : null
  return (
    <div className="mx-auto min-h-dvh max-w-4xl px-4 py-5 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <Link href="/ios" aria-label={text.home}><Logo decorative width={136} /></Link>
        <Link href={actor?.role === 'STUDENT' ? '/student/profile' : '/login?next=/ios'} className="rounded-md px-3 py-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{actor ? text.account : text.login}</Link>
      </header>
      <main>
        {actor && actor.role !== 'STUDENT' ? <p role="alert" className="rounded-xl border bg-card p-5">{text.otherRole}</p>
          : gate?.required ? <PhoneGate phone={gate.phone} sms={gate.channels.sms} callNumber={gate.channels.callNumber} /> : children}
      </main>
      <footer className="mt-8 space-y-3 border-t py-5 text-sm leading-relaxed text-muted-foreground">
        <p>{text.mode}</p>
        <Link href="/privacy" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">{text.privacy}</Link>
      </footer>
    </div>
  )
}
