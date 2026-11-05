import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { REF_COOKIE } from '@/lib/referral'
import { AuthCard } from '@/components/domain/auth-card'
import { Alert } from '@/components/ui/misc'
import { getCurrentActor, homeFor } from '@/server/auth/current-user'
import { OAUTH_SIGNUP_COOKIE } from '@/server/auth/oauth-flow'
import { getDb } from '@/server/db/client'
import { readSignupTicket } from '@/server/services/oauth.service'
import { listLevels, listStreams, listWilayas } from '@/server/services/reference.service'
import { normalizePromoCode, referralPolicy } from '@/server/services/referrals.service'
import { OAuthCompleteForm } from './complete-form'

export const metadata = { title: 'إكمال الحساب' }
export const dynamic = 'force-dynamic'

/** بعد «المتابعة بحساب Google / Apple» لأول مرة: بيانات التلميذ التي لا يعطيها المزوّد */
export default async function CompleteOAuthSignupPage() {
  const actor = await getCurrentActor()
  if (actor) redirect(homeFor(actor.role))
  const db = await getDb()
  const jar = await cookies()
  const ticket = await readSignupTicket(db, jar.get(OAUTH_SIGNUP_COOKIE)?.value)
  if (!ticket) {
    return (
      <AuthCard title="انتهت المهلة">
        <Alert tone="warning">انتهت مهلة إكمال التسجيل (30 دقيقة). ارجع واضغط زر Google أو Apple من جديد.</Alert>
        <Link href="/register" className="mt-4 block text-center text-sm font-bold text-primary hover:underline">
          العودة إلى التسجيل
        </Link>
      </AuthCard>
    )
  }
  const [wilayas, levels, streams, policy] = await Promise.all([listWilayas(db), listLevels(db), listStreams(db), referralPolicy(db)])
  const providerName = ticket.provider === 'APPLE' ? 'Apple' : 'Google'
  const shownEmail = ticket.email && !ticket.email.endsWith('@privaterelay.appleid.com') ? ticket.email : null
  return (
    <AuthCard title="خطوة أخيرة" subtitle={`تحقّقنا من حسابك في ${providerName}. أكمل بياناتك لننشئ حسابك في مدرسة.`}>
      <OAuthCompleteForm
        defaultName={ticket.fullName ?? ''}
        email={shownEmail}
        wilayas={wilayas.map((w) => ({ id: w.id, name: `${w.code} — ${w.nameAr}` }))}
        levels={levels.map((l) => ({ id: l.id, name: l.nameAr, secondary: /AS$/i.test(l.code) }))}
        streams={streams.map((s) => ({ id: s.id, name: s.nameAr }))}
        referral={policy.enabled ? { defaultCode: normalizePromoCode(jar.get(REF_COOKIE)?.value) ?? '', welcomeCreditDzd: policy.welcomeCreditDzd } : null}
      />
    </AuthCard>
  )
}
