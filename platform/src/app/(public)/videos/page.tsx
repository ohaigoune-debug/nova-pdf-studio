import { VideoDirectory } from '@/components/domain/video-directory'
import { PageHeader } from '@/components/ui/misc'
import { getDb } from '@/server/db/client'
import { listDirectoryVideos } from '@/server/services/educators.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'فيديوهات الأساتذة' }

type Q = { subject?: string; level?: string; educator?: string }

export default async function VideosPage({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams
  const data = await listDirectoryVideos(await getDb(), q)
  return (
    <div className="container py-10">
      <PageHeader title="فيديوهات الأساتذة" description="دروس مصوّرة من قنوات أساتذة جزائريين معتمدة في الدليل، مصنّفة بالمادة والصف." />
      <VideoDirectory data={data} basePath="/videos" current={q} />
    </div>
  )
}
