import { WorkerQueue } from '@/components/worker/worker-orders'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { queueSummary } from '@/server/services/confirm-reservations.service'
import { listConfirmationQueue } from '@/server/services/store.service'
import { toWorkerOrder } from './worker-order'

export const dynamic = 'force-dynamic'

/** «حجوزاتي»: الموظف يرى ما حجزه فقط (أو الطابور كله إن عُطّل الحجز)، والمشرف يرى الطابور كله */
export default async function WorkerQueuePage() {
  const actor = (await getCurrentActor())!
  const db = await getDb()
  const [rows, s] = await Promise.all([listConfirmationQueue(db, actor), queueSummary(db, actor)])
  const claim = actor.role === 'CONFIRMER' && s.policy.enabled ? { held: s.mine, max: s.policy.maxHeld, free: s.free, until: s.mineUntil ? s.mineUntil.toISOString() : null } : null
  return <WorkerQueue orders={rows.map((r) => toWorkerOrder(r, actor))} claim={claim} />
}
