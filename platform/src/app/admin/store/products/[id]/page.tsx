import { and, asc, eq, isNull } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProductForm } from '@/components/domain/product-form'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { files, productFiles, products } from '@/server/db/schema'
import { bankFormOptions } from '@/server/queries/bank-options'

export const dynamic = 'force-dynamic'

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const db = await getDb()
  const [product] = await db.select().from(products).where(and(eq(products.id, id), isNull(products.deletedAt))).limit(1)
  if (!product) notFound()
  const [opts, pf] = await Promise.all([bankFormOptions(db, actor), db.select({ id: productFiles.id, label: productFiles.label, name: files.originalName }).from(productFiles).innerJoin(files, eq(files.id, productFiles.fileId)).where(eq(productFiles.productId, id)).orderBy(asc(productFiles.sortOrder))])
  return (
    <>
      <PageHeader
        title={product.title}
        description={`/store/${product.slug}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/store/${product.slug}`} target="_blank">
              عرض في المتجر
            </Link>
          </Button>
        }
      />
      <div className="max-w-3xl">
        <ProductForm product={product} files={pf} options={{ subjects: opts.subjects, levels: opts.levels, streams: opts.streams }} />
      </div>
    </>
  )
}
