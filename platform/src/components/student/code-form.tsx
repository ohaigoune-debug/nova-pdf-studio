'use client'

import { CheckCircle2, KeyRound, LogIn, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useState } from 'react'
import { FormError, SubmitButton } from '@/components/forms/form-bits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { COURSE_CODE_DIGITS, ORDER_CODE_DIGITS, codeDigits, codeKind } from '@/lib/code-input'
import { redeemCodeAction, rememberCodeAction } from '@/server/actions/code.actions'

/** خانة الكود: تقبل الأرقام العربية والفرنسية وتحذف الفراغات، وتعدّ الأرقام أمام التلميذ */
function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const n = value.length
  const kind = codeKind(value)
  return (
    <div className="space-y-2">
      <label htmlFor="code" className="block text-center text-base font-bold">
        اكتب الكود كما هو مكتوب عندك
      </label>
      <Input
        id="code"
        name="code"
        value={value}
        onChange={(e) => onChange(codeDigits(e.currentTarget.value).slice(0, COURSE_CODE_DIGITS))}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        dir="ltr"
        placeholder="00000000000"
        aria-describedby="code-count"
        className="h-16 text-center font-mono text-3xl tracking-[0.18em] placeholder:text-muted-foreground/30"
      />
      <p id="code-count" className={`text-center text-sm ${kind ? 'font-semibold text-success' : 'text-muted-foreground'}`} aria-live="polite">
        {kind === 'COURSE' ? '✓ كود دورة كامل (11 رقمًا)' : kind === 'ORDER' && n === ORDER_CODE_DIGITS ? '✓ كود طلب (6 أرقام) — أو أكمل إن كان كود دورة' : `كتبت ${n} من 11 رقمًا`}
      </p>
    </div>
  )
}

/** التلميذ المسجَّل: يكتب الكود ويضغط زرًّا واحدًا */
export function RedeemCodeForm({ initialCode }: { initialCode?: string | null }) {
  const [state, action] = useActionState(redeemCodeAction, null)
  const [code, setCode] = useState(codeDigits(initialCode ?? '').slice(0, COURSE_CODE_DIGITS))
  const needsPhone = state && !state.ok && state.error.code === 'CLAIM_NEEDS_PHONE'
  if (state?.ok) {
    return (
      <div className="space-y-4 text-center" data-testid="code-success">
        <CheckCircle2 className="mx-auto size-16 text-success" />
        <p className="text-xl font-bold leading-relaxed">مبروك! فُعّلت دورة «{state.data.courseTitle}»</p>
        <Button asChild size="lg" className="w-full">
          <Link href={state.data.href}>ادخل الدورة الآن</Link>
        </Button>
      </div>
    )
  }
  return (
    <form action={action} className="space-y-4">
      <CodeInput value={code} onChange={setCode} />
      {needsPhone ? (
        <div className="space-y-1.5">
          <label htmlFor="phone" className="block text-sm font-semibold">
            الهاتف الذي وصله الكود
          </label>
          <Input id="phone" name="phone" type="tel" inputMode="numeric" dir="ltr" placeholder="05XXXXXXXX" className="h-12 text-center font-mono text-lg" autoFocus />
        </div>
      ) : null}
      <FormError state={state} />
      <SubmitButton size="lg" className="h-14 w-full text-lg" disabled={!codeKind(code)}>
        <KeyRound className="size-5" /> فعّل الدورة
      </SubmitButton>
    </form>
  )
}

/** زائر بلا حساب: نحفظ الكود، ثم حساب جديد أو دخول، فيجده مكتوبًا */
export function GuestCodeForm({ initialCode }: { initialCode?: string | null }) {
  const [state, action] = useActionState(rememberCodeAction, null)
  const [code, setCode] = useState(codeDigits(initialCode ?? '').slice(0, COURSE_CODE_DIGITS))
  if (state?.ok) {
    return (
      <div className="space-y-4" data-testid="code-saved">
        <div className="rounded-xl bg-success/10 p-4 text-center">
          <CheckCircle2 className="mx-auto mb-2 size-10 text-success" />
          <p className="text-lg font-bold">حفظنا كودك ✓</p>
          <p className="mt-1 text-sm text-muted-foreground">بقيت خطوة: أنشئ حسابك أو ادخل إليه، وستجد الكود مكتوبًا فتضغط «فعّل».</p>
        </div>
        <Button asChild size="lg" className="h-14 w-full text-lg">
          <Link href="/register">
            <UserPlus className="size-5" /> ليس لي حساب: أنشئ حسابي
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-14 w-full text-lg">
          <Link href={`/login?next=${encodeURIComponent('/student/code')}`}>
            <LogIn className="size-5" /> لي حساب: ادخل
          </Link>
        </Button>
      </div>
    )
  }
  return (
    <form action={action} className="space-y-4">
      <CodeInput value={code} onChange={setCode} />
      <FormError state={state} />
      <SubmitButton size="lg" className="h-14 w-full text-lg" disabled={!codeKind(code)}>
        متابعة
      </SubmitButton>
    </form>
  )
}

/** ثلاث خطوات تُقرأ في ثانيتين */
export function CodeSteps() {
  const steps = ['اكتب الكود (11 رقمًا) كما هو', 'اضغط «فعّل الدورة»', 'ادخل دورتك من «دوراتي»']
  return (
    <ol className="grid gap-2 text-sm sm:grid-cols-3">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2 rounded-lg border bg-card p-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">{i + 1}</span>
          <span className="font-semibold">{s}</span>
        </li>
      ))}
    </ol>
  )
}
