import { youtubeEmbedUrl } from '@/server/lib/youtube'

/** فيديو يوتيوب داخل التطبيق: نسخة الخصوصية المعزّزة، بلا اقتراحات، بنسبة 16:9 */
export function YouTubeEmbed({ youtubeId, title }: { youtubeId: string; title: string }) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border bg-black" style={{ aspectRatio: '16 / 9' }}>
      <iframe
        src={youtubeEmbedUrl(youtubeId)}
        title={title}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
      />
    </div>
  )
}
