import { WorkerDeck } from '@/components/worker/worker-deck'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { queueSummary } from '@/server/services/confirm-reservations.service'
import { listStreams, listWilayas } from '@/server/services/reference.service'
import { listConfirmationQueue } from '@/server/services/store.service'
import { toWorkerOrder } from './worker-order'

export const dynamic = 'force-dynamic'

/**
 * «حجوزاتي» كلعبة (قرار المالك 4 نوفمبر 2026): زبون واحد في كل مرة حتى تنتهي الحجوزات.
 * الموظف يرى ما حجزه فقط (أو الطابور كله إن عُطّل الحجز)، والمشرف يرى الطابور كله.
 */
export default async function WorkerQueuePage() {
  const actor = (await getCurrentActor())!
  const db = await getDb()
  const [rows, s, streamRows, wilayaRows] = await Promise.all([listConfirmationQueue(db, actor), queueSummary(db, actor), listStreams(db), listWilayas(db)])
  const claim = actor.role === 'CONFIRMER' && s.policy.enabled ? { held: s.mine, max: s.policy.maxHeld, free: s.free, until: s.mineUntil ? s.mineUntil.toISOString() : null } : null
  return (
    <WorkerDeck
      orders={rows.map((r) => toWorkerOrder(r, actor))}
      claim={claim}
      userId={actor.userId}
      streams={streamRows.map((r) => ({ id: r.id, name: r.nameAr }))}
      wilayas={wilayaRows.map((w) => ({ id: w.id, name: `${w.code} — ${w.nameAr}` }))}
    />
  )
}
