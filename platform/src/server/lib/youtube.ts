/**
 * استخراج معرّف فيديو يوتيوب من الصيغ الشائعة:
 * youtube.com/watch?v=ID · youtu.be/ID · youtube.com/shorts/ID · /embed/ID · /live/ID · youtube-nocookie.com/embed/ID
 * المعرّف: 11 حرفاً من [A-Za-z0-9_-]. أي شيء آخر ⇒ null (لا نضمّن إلا يوتيوب).
 */
const ID_RE = /^[A-Za-z0-9_-]{11}$/

export function parseYoutubeId(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  if (ID_RE.test(raw)) return raw
  let url: URL
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\.|^m\./, '')
  const pick = (v: string | null | undefined) => (v && ID_RE.test(v) ? v : null)
  if (host === 'youtu.be') return pick(url.pathname.split('/')[1])
  if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
    const v = url.searchParams.get('v')
    if (v) return pick(v)
    const parts = url.pathname.split('/').filter(Boolean)
    const kind = parts[0]
    if (kind === 'shorts' || kind === 'embed' || kind === 'live' || kind === 'v') return pick(parts[1])
  }
  return null
}

/** رابط التضمين بخصوصية معزّزة (بلا كوكيز تتبّع) وبلا اقتراحات فيديوهات خارجية */
export function youtubeEmbedUrl(id: string): string {
  const p = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1', iv_load_policy: '3', color: 'white' })
  return `https://www.youtube-nocookie.com/embed/${id}?${p.toString()}`
}

export function youtubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}
