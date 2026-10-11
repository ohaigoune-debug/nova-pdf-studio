import { VideoHub, type VideoHubQuery } from '@/components/domain/video-directory'
import { PageHeader } from '@/components/ui/misc'
import { getDb } from '@/server/db/client'
import { currentLevel } from '@/server/queries/level-scope'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'الفيديوهات والقنوات' }

export default async function VideosPage({ searchParams }: { searchParams: Promise<VideoHubQuery> }) {
  const q = await searchParams
  const db = await getDb()
  const level = await currentLevel(db, q.level)
  return (
    <div className="container py-10">
      <PageHeader title="الفيديوهات والقنوات" description={`كل من شرح الدرس نفسه في مكان واحد — من قنوات أساتذة جزائريين معتمدة${level ? ` — ${level.label}` : ''}. أو تصفّح قناة بعينها.`} />
      <VideoHub db={db} basePath="/videos" q={q} levelId={level?.id ?? null} />
    </div>
  )
}
