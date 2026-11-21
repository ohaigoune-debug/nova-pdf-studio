import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AuthCard } from '@/components/domain/auth-card'
import { CodeSteps, GuestCodeForm } from '@/components/student/code-form'
import { Alert } from '@/components/ui/misc'
import { getCurrentActor, homeFor } from '@/server/auth/current-user'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'فعّل دورتك بالكود' }

/**
 * madrasadz.com/code — الرابط القصير الذي يكتبه الأستاذ على السبورة (21 نوفمبر 2026).
 * التلميذ المسجَّل يذهب إلى صفحته مباشرة؛ الزائر يكتب كوده فيُحفظ، ثم يُنشئ حسابه أو يدخل فيجده مكتوبًا.
 */
export default async function CodePage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const actor = await getCurrentActor()
  const { c } = await searchParams
  if (actor?.role === 'STUDENT') redirect(`/student/code${c ? `?c=${encodeURIComponent(c)}` : ''}`)
  return (
    <AuthCard title="🔑 فعّل دورتك بالكود" subtitle="اكتب الكود الذي أخذته من الأستاذ أو من المكتبة.">
      {actor ? (
        <Alert tone="warning">
          التفعيل يكون على حساب التلميذ.{' '}
          <Link href={homeFor(actor.role)} className="font-bold underline">
            العودة
          </Link>
        </Alert>
      ) : (
        <div className="space-y-5">
          <GuestCodeForm initialCode={c} />
          <CodeSteps />
        </div>
      )}
    </AuthCard>
  )
}
