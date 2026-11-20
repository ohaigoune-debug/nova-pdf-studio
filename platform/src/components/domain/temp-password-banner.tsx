import { KeyRound, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TempLoginState } from '@/server/services/temp-login.service'
import { FirstPasswordForm } from './first-password-form'

const fmtCode = (c: string) => `${c.slice(0, 3)} ${c.slice(3)}`

/**
 * لافتة الحساب الذي سجّل دون كلمة سر (18 نوفمبر 2026): زرقاء تذكّر برمز الدخول (الأيام 1–4)،
 * برتقالية تحذّر من انتهائه (من اليوم 5). بعد الانتهاء تحلّ محلّها صفحة TempPasswordGate.
 */
export function TempPasswordBanner({ state }: { state: TempLoginState }) {
  const warn = state.stage === 'WARN'
  return (
    <div className={`mb-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${warn ? 'border-warning/40 bg-warning/10' : 'border-primary/30 bg-secondary'}`} role="status">
      <div className="flex items-start gap-3">
        {warn ? <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden /> : <KeyRound className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />}
        <div className="space-y-1 text-sm">
          <p className="font-bold">{warn ? `ينتهي رمز دخولك ${state.daysLeft <= 1 ? 'خلال يوم' : state.daysLeft === 2 ? 'بعد يومين' : `بعد ${state.daysLeft} أيام`} — أنشئ كلمة سرك الآن` : 'أنشئ كلمة سرك لتحفظ حسابك'}</p>
          {state.code ? (
            <p className="text-muted-foreground">
              رمز دخولك المؤقت: <span dir="ltr" className="font-mono text-base font-extrabold text-foreground">{fmtCode(state.code)}</span> — تدخل به مع رقم هاتفك {warn ? 'حتى انتهائه' : `(صالح ${state.daysLeft} أيام)`}.
            </p>
          ) : null}
        </div>
      </div>
      <Button asChild size="sm" variant={warn ? 'default' : 'outline'} className="shrink-0">
        <Link href="/student/password">أنشئ كلمة السر</Link>
      </Button>
    </div>
  )
}

/** بعد انتهاء الرمز المؤقت: كلمة السر قبل المتابعة — الدورات والاشتراكات كما هي */
export function TempPasswordGate({ next }: { next?: string }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" aria-hidden /> أنشئ كلمة سرك للمتابعة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">انتهى أسبوع رمز الدخول المؤقت. دوراتك واشتراكاتك محفوظة كما هي — أنشئ كلمة سر تدخل بها من الآن، ثم تتابع من حيث توقّفت.</p>
          <FirstPasswordForm next={next} />
        </CardContent>
      </Card>
    </div>
  )
}
