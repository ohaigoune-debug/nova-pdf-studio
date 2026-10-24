import type { ReactNode } from 'react'
import { OutboxSync } from '@/components/domain/outbox-sync'
import { PhoneGate } from '@/components/domain/phone-gate'
import { AppShell } from '@/components/layout/app-shell'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { phoneGateFor } from '@/server/services/phone-gate.service'

export const dynamic = 'force-dynamic'

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const actor = await requirePageActor('STUDENT')
  // الحساب الجديد لا يدخل قبل تأكيد هاتفه (رمز SMS أو مكالمة فائتة) — لا يمسّ الحسابات القديمة
  const gate = await phoneGateFor(await getDb(), actor.userId)
  return (
    <AppShell actor={actor}>
      <OutboxSync />
      {gate.required ? <PhoneGate phone={gate.phone} sms={gate.channels.sms} callNumber={gate.channels.callNumber} /> : children}
    </AppShell>
  )
}
