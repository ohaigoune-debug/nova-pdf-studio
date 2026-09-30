/* eslint-disable @next/next/no-img-element -- صور يوتيوب المصغّرة الخارجية */
import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { YouTubeEmbed } from '@/components/domain/youtube-embed'
import { Badge } from '@/components/ui/badge'
import type { getDirectoryVideo } from '@/server/services/educators.service'

type Video = Awaited<ReturnType<typeof getDirectoryVideo>>

/** مشغّل فيديو الدليل داخل المنصة مع الإسناد إلى القناة والمزيد من الأستاذ نفسه */
export function VideoPlayerPage({ video, basePath }: { video: Video; basePath: string }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <YouTubeEmbed youtubeId={video.youtubeId!} title={video.title} />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {video.subject?.nameAr ? (
            <Link href={`${basePath}?subject=${video.subject.slug}`}>
              <Badge variant="secondary">{video.subject.nameAr}</Badge>
            </Link>
          ) : null}
          {video.level?.nameAr ? <Badge variant="muted">{video.level.nameAr}</Badge> : null}
          {video.topic ? <Badge variant="default">{video.topic}</Badge> : null}
        </div>
        {video.description ? (
          <p className="whitespace-pre-line text-sm text-muted-foreground" dir="auto">
            {video.description}
          </p>
        ) : null}
        <p className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          {video.educator?.thumbnail ? <img src={video.educator.thumbnail} alt="" className="size-8 rounded-full" /> : null}
          <span>
            {video.attribution} — قناة <strong>{video.educator?.channelTitle ?? video.educator?.name}</strong>
          </span>
          {video.sourceUrl ? (
            <a href={video.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline">
              <ExternalLink className="size-3" /> فتح على يوتيوب
            </a>
          ) : null}
        </p>
      </div>
      {video.more.length ? (
        <aside className="space-y-2">
          <p className="text-sm font-bold">المزيد من {video.educator?.name}</p>
          <ul className="space-y-2">
            {video.more.map((m) => (
              <li key={m.id}>
                <Link href={`${basePath}/${m.id}`} className="flex gap-2 rounded-lg border p-2 hover:border-primary/50">
                  {m.thumbnail ? <img src={m.thumbnail} alt="" className="w-24 shrink-0 rounded object-cover" style={{ aspectRatio: '16 / 9' }} loading="lazy" /> : null}
                  <span className="line-clamp-2 text-xs" dir="auto">
                    {m.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {video.educator?.id ? (
            <Link href={`${basePath}?educator=${video.educator.id}`} className="block text-xs text-primary underline">
              كل فيديوهات الأستاذ
            </Link>
          ) : null}
        </aside>
      ) : null}
    </div>
  )
}
