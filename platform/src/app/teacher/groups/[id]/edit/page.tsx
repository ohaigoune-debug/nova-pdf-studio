import { notFound } from 'next/navigation'
import { GroupForm } from '@/components/domain/group-form'
import { ArchiveGroupButton } from '@/components/domain/member-actions'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { getGroupDetail } from '@/server/services/groups.service'
import { listAcademicYears, listLevels, listSchools, listStreams, listWilayas } from '@/server/services/reference.service'

export default async function EditGroupPage({ params }: { params: Promise<{ id: string }> }) {
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
  const [wilayas, schools, levels, streams, years] = await Promise.all([listWilayas(db), listSchools(db, actor), listLevels(db), listStreams(db), listAcademicYears(db)])
  return (
    <>
      <PageHeader title={t('groups.edit')} description={g.name} actions={<ArchiveGroupButton groupId={g.id} />} />
      <Card className="max-w-3xl">
        <CardContent className="p-6">
          <GroupForm
            groupId={g.id}
            defaults={{
              name: g.name,
              wilayaId: g.wilayaId,
              schoolId: g.schoolId,
              levelId: g.levelId,
              streamId: g.streamId,
              academicYearId: g.academicYearId,
              dayOfWeek: g.dayOfWeek,
              startTime: g.startTime,
              durationMinutes: g.durationMinutes,
              room: g.room,
              capacity: g.capacity,
              startsOn: g.startsOn,
              endsOn: g.endsOn,
              status: g.status,
              lateAfterMinutes: g.lateAfterMinutes,
              maxUnexcusedAbsences: g.maxUnexcusedAbsences,
              notes: g.notes
            }}
            wilayas={wilayas.map((w) => ({ id: w.id, name: `${w.code} — ${w.nameAr}` }))}
            schools={schools.map((s) => ({ id: s.id, name: `${s.name} (${s.wilayaName})`, wilayaId: s.wilayaId }))}
            levels={levels.map((l) => ({ id: l.id, name: l.nameAr }))}
            streams={streams.map((s) => ({ id: s.id, name: s.nameAr }))}
            years={years.map((y) => ({ id: y.id, name: y.label }))}
          />
        </CardContent>
      </Card>
    </>
  )
}
