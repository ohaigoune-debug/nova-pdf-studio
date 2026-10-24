import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AuthCard } from '@/components/domain/auth-card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/misc'
import { getT } from '@/i18n/server'
import { getCurrentActor, homeFor } from '@/server/auth/current-user'

export async function generateMetadata() {
  const { t: tt } = await getT()
  return { title: tt('activate.title') }
}
export const dynamic = 'force-dynamic'

export default async function ActivateCodePage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { t, locale } = await getT()
  const actor = await getCurrentActor()
  const { code } = await searchParams
  // التلميذ: لا انضمام لأفواج بالكود بعد التحوّل إلى الدورات (2026-10-24) — كود التفعيل الوحيد هو كود الدورة في /claim
  if (actor?.role === 'STUDENT') redirect('/claim')
  return (
    <AuthCard locale={locale} title={t('activate.title')} subtitle={t('activate.subtitle')}>
      {!actor ? (
        <div className="space-y-4">
          <Alert tone="info">{t('activate.needLogin')}</Alert>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button asChild>
              <Link href={`/register${code ? `?code=${encodeURIComponent(code)}` : ''}`}>{t('nav.register')}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/login?next=${encodeURIComponent(`/activate-code${code ? `?code=${code}` : ''}`)}`}>{t('nav.login')}</Link>
            </Button>
          </div>
        </div>
      ) : (
        <Alert tone="warning">
          هذه الصفحة للطلاب فقط.{' '}
          <Link href={homeFor(actor.role)} className="font-bold underline">
            {t('nav.dashboard')}
          </Link>
        </Alert>
      )}
    </AuthCard>
  )
}
