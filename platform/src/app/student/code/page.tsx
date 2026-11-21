import { LifeBuoy } from 'lucide-react'
import Link from 'next/link'
import { CodeSteps, RedeemCodeForm } from '@/components/student/code-form'
import { HubTabs } from '@/components/student/hub-tabs'
import { requirePageActor } from '@/server/auth/current-user'
import { readPendingCode } from '@/server/lib/pending-code'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'تفعيل دورة بالكود' }

/**
 * /student/code — تفعيل دورة بالكود (21 نوفمبر 2026): خانة واحدة، زرّ واحد.
 * الكود يأتي من الرابط (?c= من بطاقة أو QR) أو ممّا كتبه التلميذ قبل أن يُنشئ حسابه.
 */
export default async function StudentCodePage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  await requirePageActor('STUDENT')
  const { c } = await searchParams
  const initial = c ?? (await readPendingCode())
  return (
    <div className="space-y-5">
      <HubTabs hub="courses" />
      <div className="mx-auto max-w-md space-y-5">
        <div className="text-center">
          <h1 className="font-heading text-2xl font-bold">🔑 فعّل دورتك بالكود</h1>
          {initial ? <p className="mt-1 text-sm font-semibold text-success">كودك مكتوب أدناه، اضغط «فعّل الدورة».</p> : null}
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <RedeemCodeForm initialCode={initial} />
        </div>
        <CodeSteps />
        <p className="text-center text-sm text-muted-foreground">
          الكود لا يعمل؟{' '}
          <Link href="/student/support" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
            <LifeBuoy className="size-4" /> أرسل صورته للدعم
          </Link>
        </p>
      </div>
    </div>
  )
}
