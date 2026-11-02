import { PhoneCall } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getCurrentActor } from '@/server/auth/current-user'
import { WorkerLoginForm } from '@/components/worker/worker-login-form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'دخول — تطبيق التأكيد' }

/** دخول تطبيق عامل التأكيد: الهاتف وكلمة السر فقط، ثم حجوزاته مباشرة */
export default async function WorkerLoginPage() {
  const actor = await getCurrentActor()
  if (actor && (actor.role === 'CONFIRMER' || actor.role === 'SUPER_ADMIN')) redirect('/worker')
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <PhoneCall className="size-7" />
          </span>
          <h1 className="text-xl font-bold">مدرسة — تطبيق التأكيد</h1>
          <p className="text-sm text-muted-foreground">ادخل برقم هاتفك وكلمة السر التي أعطتك إياها الإدارة.</p>
        </div>
        {actor ? <p className="rounded-md border bg-card p-3 text-center text-sm">هذا التطبيق لموظفي التأكيد فقط. أنت داخل بحساب آخر: اخرج منه أولًا من الموقع.</p> : <WorkerLoginForm />}
      </div>
    </main>
  )
}
