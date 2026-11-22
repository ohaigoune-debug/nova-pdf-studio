import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { isPathHidden } from '@/lib/student-menu'
import { OutboxSync } from '@/components/domain/outbox-sync'
import { PhoneGate } from '@/components/domain/phone-gate'
import { TempPasswordBanner, TempPasswordGate } from '@/components/domain/temp-password-banner'
import { AppShell } from '@/components/layout/app-shell'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { phoneGateFor } from '@/server/services/phone-gate.service'
import { studentHiddenPaths } from '@/server/services/ios-only.service'
import { tempLoginState } from '@/server/services/temp-login.service'
import { isOwnPracticeRunPath } from '@/server/services/lesson-practice.service'

export const dynamic = 'force-dynamic'

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const actor = await requirePageActor('STUDENT')
  // الحساب الجديد لا يدخل قبل تأكيد هاتفه (رمز SMS أو مكالمة فائتة) — لا يمسّ الحسابات القديمة
  const db = await getDb()
  // قسم أخفاه المشرف، أو PLAY والبنك خارج تطبيق آيفون: لا يُفتح ولو بالرابط المباشر
  const hidden = await studentHiddenPaths(db)
  const path = (await headers()).get('x-pathname') ?? ''
  // استثناء: تمرين بدأ من تحت درس دورته (جولة/محاولة يملكها) يبقى مفتوحًا ولو أُخفي PLAY
  if (hidden.length && isPathHidden(path, hidden) && !(await isOwnPracticeRunPath(db, actor, path))) redirect('/student')
  const [gate, temp] = await Promise.all([phoneGateFor(db, actor.userId), tempLoginState(db, actor.userId).catch(() => null)])
  // سجّل دون كلمة سر (18 نوفمبر 2026): لافتة تذكير/تحذير برمز الدخول المؤقت، وبعد انتهائه كلمة السر قبل المتابعة
  const onPasswordPage = path.startsWith('/student/password')
  const body = gate.required ? (
    <PhoneGate phone={gate.phone} sms={gate.channels.sms} callNumber={gate.channels.callNumber} />
  ) : temp?.stage === 'EXPIRED' && !onPasswordPage ? (
    <TempPasswordGate next={path || undefined} />
  ) : (
    children
  )
  return (
    <AppShell actor={actor}>
      <OutboxSync />
      {temp && temp.stage !== 'EXPIRED' && !onPasswordPage ? <TempPasswordBanner state={temp} /> : null}
      {body}
    </AppShell>
  )
}
