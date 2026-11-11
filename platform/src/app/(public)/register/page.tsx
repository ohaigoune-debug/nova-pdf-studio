import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { REF_COOKIE } from '@/lib/referral'
import { AuthCard } from '@/components/domain/auth-card'
import { getT } from '@/i18n/server'
import { getCurrentActor, homeFor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listLevels, listStreams, listWilayas } from '@/server/services/reference.service'
import { normalizePromoCode, referralPolicyForDisplay } from '@/server/services/referrals.service'
import { RegisterForm } from './register-form'

export async function generateMetadata() {
  const { t: tt } = await getT()
  return { title: tt('auth.registerTitle') }
}
export const dynamic = 'force-dynamic'

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { t, locale } = await getT()
  const actor = await getCurrentActor()
  if (actor) redirect(homeFor(actor.role))
  const db = await getDb()
  const [wilayas, levels, streams, policy] = await Promise.all([listWilayas(db), listLevels(db), listStreams(db), referralPolicyForDisplay(db)])
  // الكود من رابط الدعوة (/r/CODE) أو من ?ref=
  const defaultRef = normalizePromoCode((await searchParams).ref) ?? normalizePromoCode((await cookies()).get(REF_COOKIE)?.value) ?? ''
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
          <span className="mt-2 block text-xs">
            مدرسة أو مكتبة أو صاحب صفحة؟{' '}
            <Link href="/partners" className="font-semibold text-primary hover:underline">
              كن شريكًا
            </Link>
          </span>
        </>
      }
    >
      <RegisterForm
        wilayas={wilayas.map((w) => ({ id: w.id, name: `${w.code} — ${w.nameAr}` }))}
        levels={levels.map((l) => ({ id: l.id, name: l.nameAr, secondary: /AS$/i.test(l.code) }))}
        streams={streams.map((s) => ({ id: s.id, name: s.nameAr }))}
        referral={policy.enabled ? { defaultCode: defaultRef, welcomeCreditDzd: policy.welcomeCreditDzd } : null}
      />
    </AuthCard>
  )
}
