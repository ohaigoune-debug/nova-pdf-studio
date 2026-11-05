import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AuthCard } from '@/components/domain/auth-card'
import { OAuthButtons } from '@/components/domain/oauth-buttons'
import { Alert } from '@/components/ui/misc'
import { errorMessage } from '@/i18n'
import { ERROR_CODES, type ErrorCode } from '@/server/lib/errors'
import { getT } from '@/i18n/server'
import { getCurrentActor, homeFor } from '@/server/auth/current-user'
import { LoginForm } from './login-form'

export async function generateMetadata() {
  const { t: tt } = await getT()
  return { title: tt('auth.loginTitle') }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string; oauth?: string }> }) {
  const { t, locale } = await getT()
  const actor = await getCurrentActor()
  if (actor) redirect(homeFor(actor.role))
  const { next, reset, oauth } = await searchParams
  // خطأ عائد من الدخول بـ Google أو Apple (رمز معروف فقط، لا نص حرّ من الرابط)
  const oauthError = oauth && (ERROR_CODES as readonly string[]).includes(oauth) ? errorMessage(oauth as ErrorCode, locale) : null
  return (
    <AuthCard
      locale={locale}
      title={t('auth.loginTitle')}
      subtitle={t('auth.loginSubtitle')}
      footer={
        <>
          {t('auth.noAccount')}{' '}
          <Link href="/register" className="font-bold text-primary hover:underline">
            {t('nav.register')}
          </Link>
        </>
      }
    >
      {oauthError ? (
        <Alert tone="destructive" className="mb-4">
          {oauthError}
        </Alert>
      ) : null}
      <OAuthButtons next={next} dividerLabel="أو بالبريد أو الهاتف" />
      <div className="mt-4">
        <LoginForm next={next} showDemo={process.env.NODE_ENV !== 'production'} resetDone={reset === '1'} />
      </div>
    </AuthCard>
  )
}
