import { notFound } from 'next/navigation'
import { VideoPlayerPage } from '@/components/domain/video-player-page'
import { PageHeader } from '@/components/ui/misc'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { getDirectoryVideo } from '@/server/services/educators.service'

export const dynamic = 'force-dynamic'

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let video: Awaited<ReturnType<typeof getDirectoryVideo>>
  try {
    video = await getDirectoryVideo(await getDb(), id)
  } catch (e) {
    if (e instanceof AppError && e.code === 'NOT_FOUND') notFound()
    throw e
  }
  return (
    <div className="container py-10">
      <PageHeader title={video.title} />
      <VideoPlayerPage video={video} basePath="/videos" />
    </div>
  )
}
