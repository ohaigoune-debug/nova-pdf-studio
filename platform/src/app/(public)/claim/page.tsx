import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AuthCard } from '@/components/domain/auth-card'
import { Alert } from '@/components/ui/misc'
import { getT } from '@/i18n/server'
import { getCurrentActor, homeFor } from '@/server/auth/current-user'
import { ClaimForm } from './claim-form'

export const metadata = { title: 'تفعيل دورة بكود' }
export const dynamic = 'force-dynamic'

/** /claim — التلميذ يُدخل هاتف الطلب والرمز الذي وصل بالـSMS بعد تسليم الكتاب */
export default async function ClaimPage({ searchParams }: { searchParams: Promise<{ phone?: string; code?: string }> }) {
  const { locale } = await getT()
  const actor = await getCurrentActor()
  const sp = await searchParams
  const self = `/claim${sp.code || sp.phone ? `?${new URLSearchParams({ ...(sp.phone ? { phone: sp.phone } : {}), ...(sp.code ? { code: sp.code } : {}) }).toString()}` : ''}`
  if (!actor) redirect(`/login?next=${encodeURIComponent(self)}`)
  return (
    <AuthCard locale={locale} title="تفعيل دورة" subtitle="وصلك كود تفعيل بالـSMS (على هاتفك أو هاتف وليّك)؟ أدخل الهاتف الذي وصله الكود والكود نفسه، فتُفعَّل الدورة على حسابك.">
      {actor.role === 'STUDENT' ? (
        <ClaimForm phone={sp.phone} code={sp.code} />
      ) : (
        <Alert tone="warning">
          التفعيل يكون على حساب التلميذ فقط. سجّل الدخول بحساب التلميذ (أو أنشئ له حساباً) ثم عد إلى هذه الصفحة.{' '}
          <Link href={homeFor(actor.role)} className="font-bold underline">
            العودة
          </Link>
        </Alert>
      )}
    </AuthCard>
  )
}
