import { notFound } from 'next/navigation'
import { VideoPlayerPage } from '@/components/domain/video-player-page'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { getDirectoryVideo } from '@/server/services/educators.service'

export default async function StudentVideoPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageActor('STUDENT')
  const { id } = await params
  let video: Awaited<ReturnType<typeof getDirectoryVideo>>
  try {
    video = await getDirectoryVideo(await getDb(), id)
  } catch (e) {
    if (e instanceof AppError && e.code === 'NOT_FOUND') notFound()
    throw e
  }
  return (
    <>
      <PageHeader title={video.title} />
      <VideoPlayerPage video={video} basePath="/student/videos" />
    </>
  )
}
