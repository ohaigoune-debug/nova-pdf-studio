import { ProductForm } from '@/components/domain/product-form'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { bankFormOptions } from '@/server/queries/bank-options'

export const dynamic = 'force-dynamic'

export default async function NewProductPage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const opts = await bankFormOptions(await getDb(), actor)
  return (
    <>
      <PageHeader title="منتج جديد" description="كتاب ورقي يُشحن ويُدفع عند الاستلام، أو ملف PDF يُنزَّل بعد التأكيد، أو حزمة." />
      <div className="max-w-3xl">
        <ProductForm options={{ subjects: opts.subjects, levels: opts.levels, streams: opts.streams }} />
      </div>
    </>
  )
}
