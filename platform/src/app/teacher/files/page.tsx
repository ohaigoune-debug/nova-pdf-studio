import { FilesPanel } from '@/components/domain/files-panel'
import { PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { signFileUrl } from '@/server/lib/storage'
import { listWorkspaceFiles } from '@/server/queries/teacher-extras.queries'

export default async function TeacherFilesPage() {
  const actor = await requirePageActor('TEACHER')
  const items = await listWorkspaceFiles(await getDb(), actor)
  return (
    <>
      <PageHeader title={t('filesMgmt.title')} description="ملفات خاصة بمساحتك تُرفق بالدروس والواجبات." />
      <FilesPanel files={items.map((f) => ({ id: f.id, originalName: f.originalName, mimeType: f.mimeType, sizeBytes: f.sizeBytes, createdAt: f.createdAt, downloadUrl: signFileUrl(f.id) }))} />
    </>
  )
}
