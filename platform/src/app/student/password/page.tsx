import { KeyRound } from 'lucide-react'
import { redirect } from 'next/navigation'
import { FirstPasswordForm } from '@/components/domain/first-password-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { tempLoginState } from '@/server/services/temp-login.service'

export const metadata = { title: 'أنشئ كلمة السر' }
export const dynamic = 'force-dynamic'

/** /student/password — أول كلمة سر لمن سجّل دون كلمة سر. من له كلمة سر عادية يغيّرها من «حسابي». */
export default async function FirstPasswordPage() {
  const actor = await requirePageActor('STUDENT')
  const state = await tempLoginState(await getDb(), actor.userId)
  if (!state) redirect('/student/profile')
  return (
    <div className="mx-auto max-w-lg py-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" aria-hidden /> أنشئ كلمة سرك
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">تدخل بها مع رقم هاتفك بدل الرمز المؤقت. لا تحتاج الرمز القديم.</p>
          <FirstPasswordForm />
        </CardContent>
      </Card>
    </div>
  )
}
