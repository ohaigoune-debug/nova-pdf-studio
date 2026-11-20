import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { REF_COOKIE } from '@/lib/referral'
import { AuthCard } from '@/components/domain/auth-card'
import { getT } from '@/i18n/server'
import { getCurrentActor, homeFor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listLevels, listStreams, listWilayas, streamsByLevel } from '@/server/services/reference.service'
import { LANDING_COOKIE, attributionFromCookie } from '@/server/services/landing.service'
import { effectiveWelcomeDzd, normalizePromoCode, referralPolicyForDisplay, resolvePromoCode, studentCreditsOn } from '@/server/services/referrals.service'
import { RegisterForm } from './register-form'

export async function generateMetadata() {
  const { t: tt } = await getT()
  return { title: tt('auth.registerTitle') }
}
export const dynamic = 'force-dynamic'

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ ref?: string; from?: string }> }) {
  const { t, locale } = await getT()
  const actor = await getCurrentActor()
  if (actor) redirect(homeFor(actor.role))
  const db = await getDb()
  const [wilayas, levels, streams, policy, levelStreams] = await Promise.all([listWilayas(db), listLevels(db), listStreams(db), referralPolicyForDisplay(db), streamsByLevel(db)])
  const sp = await searchParams
  const jar = await cookies()
  // الكود من رابط الدعوة (/r/CODE) أو من ?ref=
  const rawRef = normalizePromoCode(sp.ref) ?? normalizePromoCode(jar.get(REF_COOKIE)?.value)
  // كود تلميذ ودعوات التلاميذ مطفأة: لا يُملأ (وإلا رُفض التسجيل بكود «غير صالح» لم يكتبه)
  const refOk = rawRef ? await resolvePromoCode(db, rawRef).then((c) => Boolean(c && (c.kind !== 'STUDENT' || policy.studentInvites))) : false
  const defaultRef = refOk && rawRef ? rawRef : ''
  // زائر من صفحة هبوط (إعلان): تسجيل دون كلمة سر ولا بريد، ثم استمارة الطلب مباشرة (18 نوفمبر 2026)
  const fromAd = sp.from === 'go' || Boolean(await attributionFromCookie(db, jar.get(LANDING_COOKIE)?.value).catch(() => null))
  return (
    <AuthCard
      locale={locale}
      title={fromAd ? 'سجّل في دقيقة' : t('auth.registerTitle')}
      subtitle={fromAd ? 'دون كلمة سر: نؤكّد رقمك برسالة قصيرة، ثم تكمل طلب دورتك مباشرة.' : t('auth.registerSubtitle')}
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
        levels={levels.map((l) => ({ id: l.id, name: l.nameAr, secondary: /AS$/i.test(l.code), streamIds: levelStreams.get(l.id) ?? [] }))}
        streams={streams.map((s) => ({ id: s.id, name: s.nameAr }))}
        referral={policy.enabled ? { defaultCode: defaultRef, welcomeCreditDzd: effectiveWelcomeDzd(policy), studentInvites: studentCreditsOn(policy) } : null}
        passwordless={fromAd}
      />
    </AuthCard>
  )
}
