import { ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { t } from '@/i18n'
import type { Actor } from '@/server/lib/actor'
import { ANON_VIEWER, signMediaUrl } from '@/server/services/media.service'
import { SecurePdfViewer } from './secure-pdf-viewer'
import { SecureVideoPlayer } from './secure-video-player'
import { YouTubeEmbed } from './youtube-embed'

export interface LessonMediaItem {
  id: string
  type: string
  title: string
  videoProvider: string | null
  youtubeId: string | null
  allowDownload: boolean
  fileId: string | null
  fileMime: string | null
  fileStatus: string | null
}

/**
 * يختار العارض المناسب: يوتيوب مضمّن، فيديو خاص محمي، PDF مختوم، صورة/صوت عبر رابط موقّع.
 * الرابط الموقّع يُولَّد في الخادم لهوية المشاهد الحالية فقط.
 */
export function LessonMedia({ item, actor }: { item: LessonMediaItem; actor: Actor | null }) {
  if (item.type === 'VIDEO' && item.videoProvider === 'YOUTUBE' && item.youtubeId) {
    return <YouTubeEmbed youtubeId={item.youtubeId} title={item.title} />
  }
  if (!item.fileId || !item.fileMime) return null
  if (item.fileStatus && item.fileStatus !== 'READY') return <p className="text-sm text-muted-foreground">{t('errors.MEDIA_NOT_READY')}</p>
  const viewerId = actor?.userId ?? ANON_VIEWER
  const src = signMediaUrl(item.fileId, item.id, viewerId)
  const date = new Date().toISOString().slice(0, 10)
  const watermark = actor ? [actor.email, `${date} · ${actor.userId.slice(0, 8)}`] : ['madrasa · public', date]
  const track = !!actor
  const protectedBadge = (
    <Badge variant="success" className="mb-2 inline-flex items-center gap-1">
      <ShieldCheck className="size-3" /> {t('media.protectedBadge')}
    </Badge>
  )
  if (item.fileMime.startsWith('video/')) {
    return (
      <div>
        {protectedBadge}
        {actor ? <SecureVideoPlayer src={src} contentId={item.id} watermark={watermark} /> : <p className="text-sm text-muted-foreground">{t('activate.needLogin')}</p>}
      </div>
    )
  }
  if (item.fileMime === 'application/pdf') {
    return (
      <div>
        {!item.allowDownload ? protectedBadge : null}
        <SecurePdfViewer src={src} contentId={item.id} allowDownload={item.allowDownload} watermark={watermark} track={track} />
      </div>
    )
  }
  if (item.fileMime.startsWith('image/')) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={item.title} className="max-h-[70vh] w-auto rounded-xl border" onContextMenu={undefined} />
  }
  if (item.fileMime.startsWith('audio/')) {
    return <audio src={src} controls controlsList="nodownload" className="w-full" />
  }
  return null
}
