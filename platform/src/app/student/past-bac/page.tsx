import { PastBacList } from '@/components/domain/past-bac-list'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listBacExams } from '@/server/services/bac.service'

type Q = { subject?: string; stream?: string; year?: string }

export default async function StudentPastBacPage({ searchParams }: { searchParams: Promise<Q> }) {
  await requirePageActor('STUDENT')
  const q = await searchParams
  const data = await listBacExams(await getDb(), { subject: q.subject, stream: q.stream, year: q.year ? Number(q.year) || null : null })
  return (
    <>
      <PageHeader title="بكالوريات سابقة" description="مواضيع البكالوريا الرسمية مع تصحيحاتها — روابط تنزيل مباشرة." />
      <PastBacList data={data} basePath="/student/past-bac" current={q} />
    </>
  )
}
