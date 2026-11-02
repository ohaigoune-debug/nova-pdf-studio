import { PosConsole } from '@/components/pos/pos-console'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { posHome } from '@/server/services/points-of-sale.service'

export const metadata = { title: 'نقطة البيع' }

export default async function PosPage() {
  const actor = await requirePageActor('POINT_OF_SALE')
  const home = await posHome(await getDb(), actor)
  return (
    <PosConsole
      pos={home.pos}
      summary={home.summary}
      codes={home.codes.map((c) => ({ ...c, createdAt: c.createdAt.toISOString(), usedAt: c.usedAt?.toISOString() ?? null }))}
    />
  )
}
