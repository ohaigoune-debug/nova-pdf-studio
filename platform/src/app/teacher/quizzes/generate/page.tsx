import { QuizGenerateForm } from '@/components/domain/quiz-generate-form'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { teacherFormOptions } from '@/server/queries/teacher-form-options'
import { getDriveSource } from '@/server/services/drive-source.service'
import { listSourceFiles } from '@/server/services/sources.service'

export default async function GenerateQuizPage({ searchParams }: { searchParams: Promise<{ drive?: string }> }) {
  const { drive: preset } = await searchParams
  const actor = await requirePageActor('TEACHER')
  const db = await getDb()
  const [opts, files, drive] = await Promise.all([
    teacherFormOptions(db, actor),
    actor.workspaceId ? listSourceFiles(db, actor.workspaceId) : [],
    actor.workspaceId ? getDriveSource(db, actor.workspaceId) : null
  ])
  return (
    <>
      <PageHeader
        title="توليد اختبار بالذكاء الاصطناعي"
        description="اختر مصادرك — ملفات من جهازك، أو روابط Drive، أو مجلدك المربوط — فيبني الذكاء الاصطناعي الأسئلة وإجاباتها منها وحدها، ولا يختلق شيئاً من عنده."
      />
      <Card className="max-w-3xl">
        <CardContent className="p-6">
          <QuizGenerateForm groups={opts.groups} files={files.map((f) => ({ id: f.id, name: f.name }))} linkedFolder={drive ? { name: drive.folderName, files: drive.files } : null} presetLink={preset?.startsWith('https://') ? preset : null} />
        </CardContent>
      </Card>
    </>
  )
}
