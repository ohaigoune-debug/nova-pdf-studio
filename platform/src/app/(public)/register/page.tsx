import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AuthCard } from '@/components/domain/auth-card'
import { getT } from '@/i18n/server'
import { getCurrentActor, homeFor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listLevels, listStreams, listWilayas } from '@/server/services/reference.service'
import { RegisterForm } from './register-form'

export async function generateMetadata() {
  const { t: tt } = await getT()
  return { title: tt('auth.registerTitle') }
}
export const dynamic = 'force-dynamic'

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { t, locale } = await getT()
  const actor = await getCurrentActor()
  if (actor) redirect(homeFor(actor.role))
  const { code } = await searchParams
  const db = await getDb()
  const [wilayas, levels, streams] = await Promise.all([listWilayas(db), listLevels(db), listStreams(db)])
  return (
    <AuthCard
      locale={locale}
      title={t('auth.registerTitle')}
      subtitle={t('auth.registerSubtitle')}
      footer={
        <>
          {t('auth.haveAccount')}{' '}
          <Link href="/login" className="font-bold text-primary hover:underline">
            {t('nav.login')}
          </Link>
        </>
      }
    >
      <RegisterForm
        code={code}
        wilayas={wilayas.map((w) => ({ id: w.id, name: `${w.code} — ${w.nameAr}` }))}
        levels={levels.map((l) => ({ id: l.id, name: l.nameAr }))}
        streams={streams.map((s) => ({ id: s.id, name: s.nameAr }))}
      />
    </AuthCard>
  )
}
