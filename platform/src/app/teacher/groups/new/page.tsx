import { GroupForm } from '@/components/domain/group-form'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listAcademicYears, listLevels, listSchools, listStreams, listWilayas } from '@/server/services/reference.service'

export default async function NewGroupPage() {
  const actor = await requirePageActor('TEACHER')
  const db = await getDb()
  const [wilayas, schools, levels, streams, years] = await Promise.all([listWilayas(db), listSchools(db, actor), listLevels(db), listStreams(db), listAcademicYears(db)])
  return (
    <>
      <PageHeader title={t('groups.new')} />
      <Card className="max-w-3xl">
        <CardContent className="p-6">
          <GroupForm
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
