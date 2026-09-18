import { FilesPanel } from '@/components/domain/files-panel'
import { VideoUploader } from '@/components/domain/video-uploader'
import { PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { MAX_VIDEO_UPLOAD_BYTES, signFileUrl } from '@/server/lib/storage'
import { listWorkspaceFiles } from '@/server/queries/teacher-extras.queries'

export default async function TeacherFilesPage() {
  const actor = await requirePageActor('TEACHER')
  const items = await listWorkspaceFiles(await getDb(), actor)
  return (
    <>
      <PageHeader title={t('filesMgmt.title')} description="ملفات خاصة بمساحتك تُرفق بالدروس والواجبات." />
      <div className="mb-6">
        <VideoUploader maxMb={Math.round(MAX_VIDEO_UPLOAD_BYTES() / (1024 * 1024))} />
      </div>
      <FilesPanel files={items.map((f) => ({ id: f.id, originalName: f.originalName, mimeType: f.mimeType, sizeBytes: f.sizeBytes, status: f.status, createdAt: f.createdAt, downloadUrl: signFileUrl(f.id) }))} />
    </>
  )
}
