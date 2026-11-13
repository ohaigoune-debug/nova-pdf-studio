import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { isPathHidden } from '@/lib/student-menu'
import { OutboxSync } from '@/components/domain/outbox-sync'
import { PhoneGate } from '@/components/domain/phone-gate'
import { AppShell } from '@/components/layout/app-shell'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { phoneGateFor } from '@/server/services/phone-gate.service'
import { studentHiddenPaths } from '@/server/services/ios-only.service'

export const dynamic = 'force-dynamic'

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const actor = await requirePageActor('STUDENT')
  // الحساب الجديد لا يدخل قبل تأكيد هاتفه (رمز SMS أو مكالمة فائتة) — لا يمسّ الحسابات القديمة
  const db = await getDb()
  // قسم أخفاه المشرف، أو PLAY والبنك خارج تطبيق آيفون: لا يُفتح ولو بالرابط المباشر
  const hidden = await studentHiddenPaths(db)
  const path = (await headers()).get('x-pathname') ?? ''
  if (hidden.length && isPathHidden(path, hidden)) redirect('/student')
  const gate = await phoneGateFor(db, actor.userId)
  return (
    <AppShell actor={actor}>
      <OutboxSync />
      {gate.required ? <PhoneGate phone={gate.phone} sms={gate.channels.sms} callNumber={gate.channels.callNumber} /> : children}
    </AppShell>
  )
}
