import { PlaylistImportForm } from '@/components/domain/playlist-import-form'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { aiProviderInfo } from '@/server/ai/provider'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { teacherFormOptions } from '@/server/queries/teacher-form-options'

export default async function ImportPlaylistPage() {
  const actor = await requirePageActor('TEACHER', 'SUPER_ADMIN')
  const opts = await teacherFormOptions(await getDb(), actor)
  const ai = aiProviderInfo()
  return (
    <>
      <PageHeader title={t('contentMgmt.importTitle')} description={t('contentMgmt.importSubtitle')} />
      <Card className="max-w-2xl">
        <CardContent className="p-6">
          <PlaylistImportForm levels={opts.levels} streams={opts.streams} hasApiKey={Boolean(process.env.YOUTUBE_API_KEY)} aiEnabled={ai.configured} />
        </CardContent>
      </Card>
    </>
  )
}
