import Link from 'next/link'
import { AuthCard } from '@/components/domain/auth-card'
import { Alert } from '@/components/ui/misc'
import { t } from '@/i18n'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { errorMessage } from '@/i18n'
import { verifyPasswordResetToken } from '@/server/services/auth.service'
import { ResetForm } from './reset-form'

export const metadata = { title: t('auth.resetTitle') }

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  let error: string | null = null
  if (!token) error = errorMessage('RESET_TOKEN_INVALID')
  else {
    try {
      await verifyPasswordResetToken(await getDb(), token)
    } catch (e) {
      error = isAppError(e) ? errorMessage(e.code) : errorMessage('INTERNAL')
    }
  }
  return (
    <AuthCard
      title={t('auth.resetTitle')}
      subtitle={t('auth.resetSubtitle')}
      footer={
        <Link href="/login" className="font-bold text-primary hover:underline">
          {t('auth.backToLogin')}
        </Link>
      }
    >
      {error ? (
        <div className="space-y-4">
          <Alert tone="destructive">{error}</Alert>
          <Link href="/forgot-password" className="block text-center text-sm font-bold text-primary hover:underline">
            {t('auth.forgotTitle')}
          </Link>
        </div>
      ) : (
        <ResetForm token={token!} />
      )}
    </AuthCard>
  )
}
