import Link from 'next/link'
import { AuthCard } from '@/components/domain/auth-card'
import { t } from '@/i18n'
import { ForgotForm } from './forgot-form'

export const metadata = { title: t('auth.forgotTitle') }

export default function ForgotPasswordPage() {
  return (
    <AuthCard
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
