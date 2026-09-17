import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { listBatches, listCodes } from '@/server/services/enrollment-codes.service'
import { getGroupDetail } from '@/server/services/groups.service'
import { CodesPanel } from './codes-panel'

export default async function GroupCodesPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  const db = await getDb()
  let g
  try {
    g = await getGroupDetail(db, actor, id)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const [codes, batches] = await Promise.all([listCodes(db, actor, g.id), listBatches(db, actor, g.id)])
  return (
    <>
      <PageHeader
        title={t('codes.title')}
        description={
          <Link href={`/teacher/groups/${g.id}`} className="hover:underline">
            {g.name}
          </Link>
        }
      />
      <CodesPanel groupId={g.id} groupName={g.name} codes={codes} batches={batches} />
    </>
  )
}
