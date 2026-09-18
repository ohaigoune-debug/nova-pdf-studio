import Link from 'next/link'
import { AuthCard } from '@/components/domain/auth-card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/misc'
import { getT } from '@/i18n/server'
import { getCurrentActor, homeFor } from '@/server/auth/current-user'
import { logoutAction } from '@/server/actions/auth.actions'
import { JoinAssistantForm } from './join-form'

export async function generateMetadata() {
  const { t: tt } = await getT()
  return { title: tt('assistant.joinTitle') }
}
export const dynamic = 'force-dynamic'

/** صفحة انضمام المساعد: كود من الأستاذ + البريد نفسه ⇒ حساب مساعد مرتبط فوراً. */
export default async function AssistantJoinPage({ searchParams }: { searchParams: Promise<{ code?: string; email?: string }> }) {
  const { t, locale } = await getT()
  const actor = await getCurrentActor()
  const { code, email } = await searchParams
  return (
    <AuthCard
      locale={locale}
      title={t('assistant.joinTitle')}
      subtitle={t('assistant.joinSubtitle')}
      footer={
        <>
          {t('auth.haveAccount')}{' '}
          <Link href="/login" className="font-bold text-primary hover:underline">
            {t('nav.login')}
          </Link>
        </>
      }
    >
      {actor ? (
        <div className="space-y-4">
          <Alert tone="warning">{t('assistant.alreadyLoggedIn')}</Alert>
          <div className="grid gap-2 sm:grid-cols-2">
            <form action={logoutAction}>
              <Button type="submit" variant="outline" className="w-full">
                {t('common.logout')}
              </Button>
            </form>
            <Button asChild>
              <Link href={homeFor(actor.role)}>{t('nav.dashboard')}</Link>
            </Button>
          </div>
        </div>
      ) : (
        <JoinAssistantForm code={code} email={email} />
      )}
    </AuthCard>
  )
}
