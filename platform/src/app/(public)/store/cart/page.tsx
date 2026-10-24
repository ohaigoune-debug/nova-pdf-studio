import { CartPage } from '@/components/domain/store-cart'
import { PageHeader } from '@/components/ui/misc'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listStreams, listWilayas } from '@/server/services/reference.service'
import { isPhoneVerified } from '@/server/services/otp.service'
import { customerDefaults, shippingFeeDzd, shippingFeeTable, storePolicy } from '@/server/services/store.service'
import { gateStoreBrowsing } from '@/server/lib/store-gate'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'السلّة' }

export default async function StoreCartPage() {
  await gateStoreBrowsing()
  const db = await getDb()
  const actor = await getCurrentActor()
  const [wilayas, streams, defaults, policy, phoneV] = await Promise.all([listWilayas(db), listStreams(db), actor ? customerDefaults(db, actor) : Promise.resolve(null), storePolicy(db), actor ? isPhoneVerified(db, actor.userId) : Promise.resolve(null)])
  return (
    <div className="container py-10">
      <PageHeader title="السلّة والطلب" />
      <CartPage loggedIn={Boolean(actor)} defaults={defaults} wilayas={wilayas.map((w) => ({ id: w.id, name: w.nameAr }))} streams={streams.map((s) => ({ id: s.id, name: s.nameAr }))} shippingDzd={shippingFeeDzd()} feeTable={await shippingFeeTable(db)} policy={policy} verifiedPhone={phoneV?.verified ? phoneV.phone : null} />
    </div>
  )
}
