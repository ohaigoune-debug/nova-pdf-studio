import { PastBacList } from '@/components/domain/past-bac-list'
import { PageHeader } from '@/components/ui/misc'
import { getDb } from '@/server/db/client'
import { listBacExams } from '@/server/services/bac.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'بكالوريات سابقة' }

type Q = { subject?: string; stream?: string; year?: string }

export default async function PastBacPage({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams
  const data = await listBacExams(await getDb(), { subject: q.subject, stream: q.stream, year: q.year ? Number(q.year) || null : null })
  return (
    <div className="container py-10">
      <PageHeader title="بكالوريات سابقة" description="مواضيع البكالوريا الرسمية لكل المواد والشعب مع تصحيحاتها النموذجية — روابط تنزيل مباشرة." />
      <PastBacList data={data} basePath="/past-bac" current={q} />
    </div>
  )
}
