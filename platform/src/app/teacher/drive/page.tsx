import { FolderOpen } from 'lucide-react'
import Link from 'next/link'
import { DriveLibrary } from '@/components/domain/drive-library'
import { Button } from '@/components/ui/button'
import { Alert, EmptyState, PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { t } from '@/i18n'
import { teacherFormOptions } from '@/server/queries/teacher-form-options'
import { listDriveLibrary } from '@/server/services/drive-library.service'

export const dynamic = 'force-dynamic'

export default async function DriveLibraryPage() {
  const actor = await requirePageActor('TEACHER')
  const db = await getDb()
  const opts = await teacherFormOptions(db, actor)
  let lib: Awaited<ReturnType<typeof listDriveLibrary>> = null
  let error: string | null = null
  try {
    lib = await listDriveLibrary(db, actor)
  } catch (e) {
    error = e instanceof AppError ? t(`errors.${e.code}` as never) : t('errors.DRIVE_FETCH_FAILED')
  }
  return (
    <>
      <PageHeader
        title="مكتبة Drive"
        description="اختر موضوعاً أو تمريناً أو درساً من مجلدك: يتعلّمه الذكاء الاصطناعي ويصوغ منه واجباً بحلّه النموذجي، أو شرحاً للتلاميذ، أو اختباراً — ولا يصل شيء إلى التلاميذ قبل مراجعتك وتأكيدك."
        actions={
          <Button asChild variant="outline">
            <Link href="/teacher/settings#drive">
              <FolderOpen className="size-4" /> تغيير المجلد
            </Link>
          </Button>
        }
      />
      {error ? <Alert tone="warning">{error}</Alert> : null}
      {!lib && !error ? (
        <EmptyState
          icon={FolderOpen}
          title="لا مجلد Drive مربوط"
          description="اربط مجلد دروسك من الإعدادات، فتظهر ملفاته هنا."
          action={
            <Button asChild>
              <Link href="/teacher/settings#drive">ربط المجلد</Link>
            </Button>
          }
        />
      ) : null}
      {lib ? <DriveLibrary folderName={lib.folderName} files={lib.files.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, viewUrl: f.viewUrl }))} opts={opts} /> : null}
    </>
  )
}
