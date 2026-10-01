import { CartPage } from '@/components/domain/store-cart'
import { PageHeader } from '@/components/ui/misc'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listWilayas } from '@/server/services/reference.service'
import { customerDefaults, shippingFeeDzd } from '@/server/services/store.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'السلّة' }

export default async function StoreCartPage() {
  const db = await getDb()
  const actor = await getCurrentActor()
  const [wilayas, defaults] = await Promise.all([listWilayas(db), actor ? customerDefaults(db, actor) : Promise.resolve(null)])
  return (
    <div className="container py-10">
      <PageHeader title="السلّة والطلب" />
      <CartPage loggedIn={Boolean(actor)} defaults={defaults} wilayas={wilayas.map((w) => ({ id: w.id, name: w.nameAr }))} shippingDzd={shippingFeeDzd()} />
    </div>
  )
}
