import { FileImportForm } from '@/components/domain/file-import-form'
import { PlaylistImportForm } from '@/components/domain/playlist-import-form'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { aiProviderInfo } from '@/server/ai/provider'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { teacherFormOptions } from '@/server/queries/teacher-form-options'
import { listSourceFiles } from '@/server/services/sources.service'

export default async function ImportPlaylistPage() {
  const actor = await requirePageActor('TEACHER', 'SUPER_ADMIN')
  const db = await getDb()
  const [opts, files] = await Promise.all([teacherFormOptions(db, actor), actor.role === 'TEACHER' && actor.workspaceId ? listSourceFiles(db, actor.workspaceId) : []])
  const ai = aiProviderInfo()
  return (
    <>
      <PageHeader title={t('contentMgmt.importTitle')} description={t('contentMgmt.importSubtitle')} />
      {actor.role === 'TEACHER' ? (
        <Card className="mb-6 max-w-2xl">
          <CardContent className="space-y-4 p-6">
            <h2 className="font-display text-2xl font-bold">ملفات الدروس</h2>
            <p className="text-sm text-muted-foreground">اختر ملفات كثيرة دفعة واحدة (PDF، Word، نص) أو الصق روابط Drive، فتصير دروساً مرتّبة.</p>
            <FileImportForm files={files.map((f) => ({ id: f.id, name: f.name }))} levels={opts.levels} streams={opts.streams} groups={opts.groups} aiEnabled={ai.configured} />
          </CardContent>
        </Card>
      ) : null}
      <Card className="max-w-2xl">
        <CardContent className="space-y-4 p-6">
          <h2 className="font-display text-2xl font-bold">قائمة تشغيل يوتيوب</h2>
          <PlaylistImportForm levels={opts.levels} streams={opts.streams} hasApiKey={Boolean(process.env.YOUTUBE_API_KEY)} aiEnabled={ai.configured} />
        </CardContent>
      </Card>
    </>
  )
}
