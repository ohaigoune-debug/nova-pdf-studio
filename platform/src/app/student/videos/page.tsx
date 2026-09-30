import { VideoDirectory } from '@/components/domain/video-directory'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listDirectoryVideos } from '@/server/services/educators.service'

type Q = { subject?: string; level?: string; educator?: string }

export default async function StudentVideosPage({ searchParams }: { searchParams: Promise<Q> }) {
  await requirePageActor('STUDENT')
  const q = await searchParams
  const data = await listDirectoryVideos(await getDb(), q)
  return (
    <>
      <PageHeader title="فيديوهات الأساتذة" description="دروس مصوّرة من قنوات أساتذة معتمدة، مصنّفة بالمادة والصف." />
      <VideoDirectory data={data} basePath="/student/videos" current={q} />
    </>
  )
}
