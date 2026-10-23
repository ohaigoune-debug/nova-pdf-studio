import { HubTabs } from '@/components/student/hub-tabs'
import { VideoHub, type VideoHubQuery } from '@/components/domain/video-directory'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { currentLevel } from '@/server/queries/level-scope'

export default async function StudentVideosPage({ searchParams }: { searchParams: Promise<VideoHubQuery> }) {
  await requirePageActor('STUDENT')
  const q = await searchParams
  const db = await getDb()
  const level = await currentLevel(db, q.level)
  return (
    <>
      <HubTabs hub="lessons" />
      <PageHeader title="الفيديوهات والقنوات" description={`كل من شرح الدرس نفسه في مكان واحد${level ? ` — ${level.label}` : ''}، أو تصفّح قناة بعينها. غيّر مستواك من صفحة «الدروس والموارد» أو أعلى الموقع.`} />
      <VideoHub db={db} basePath="/student/videos" q={q} levelId={level?.id ?? null} />
    </>
  )
}
