import Link from 'next/link'
import { AuthCard } from '@/components/domain/auth-card'
import { getT } from '@/i18n/server'
import { ForgotForm } from './forgot-form'

export async function generateMetadata() {
  const { t: tt } = await getT()
  return { title: tt('auth.forgotTitle') }
}

export default async function ForgotPasswordPage() {
  const { t, locale } = await getT()
  return (
    <AuthCard
      locale={locale}
      title={t('auth.forgotTitle')}
      subtitle={t('auth.forgotSubtitle')}
      footer={
        <Link href="/login" className="font-bold text-primary hover:underline">
          {t('auth.backToLogin')}
        </Link>
      }
    >
      <ForgotForm />
    </AuthCard>
  )
}
