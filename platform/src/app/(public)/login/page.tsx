import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AuthCard } from '@/components/domain/auth-card'
import { t } from '@/i18n'
import { getCurrentActor, homeFor } from '@/server/auth/current-user'
import { LoginForm } from './login-form'

export const metadata = { title: t('auth.loginTitle') }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const actor = await getCurrentActor()
  if (actor) redirect(homeFor(actor.role))
  const { next, reset } = await searchParams
  return (
    <AuthCard
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
      <LoginForm next={next} showDemo={process.env.NODE_ENV !== 'production'} resetDone={reset === '1'} />
    </AuthCard>
  )
}
