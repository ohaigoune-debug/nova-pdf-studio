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

/**
 * معرّف قائمة تشغيل: PL… (قائمة عادية) · UU…/UC… (رفوعات قناة) · OL… (ألبوم) · FL/LL (مفضلة/إعجابات).
 * RD… قوائم مزج يولّدها يوتيوب لكل مشاهد ولا تُقرأ عبر الواجهة ⇒ مرفوضة.
 */
const PLAYLIST_RE = /^(PL|UU|UC|OL|FL|LL)[A-Za-z0-9_-]{10,}$/

export function parsePlaylistId(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  if (PLAYLIST_RE.test(raw)) return raw
  let url: URL
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\.|^m\./, '')
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com' && host !== 'music.youtube.com') return null
  const list = url.searchParams.get('list')
  return list && PLAYLIST_RE.test(list) ? list : null
}

export interface PlaylistItem {
  youtubeId: string
  title: string
  description: string | null
}

/** يوتيوب يُبقي الفيديو المحذوف/الخاص في القائمة بعنوان ثابت؛ استيراده يعطي درساً لا يُفتح */
const UNAVAILABLE = ['Private video', 'Deleted video', 'This video is unavailable']

function usable(item: PlaylistItem): boolean {
  return Boolean(item.youtubeId) && !UNAVAILABLE.includes(item.title.trim())
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
}

/** تغذية RSS العامة: بلا مفتاح، لكن يوتيوب يحدّها بآخر 15 فيديو */
export const RSS_LIMIT = 15

function parseRss(xml: string): PlaylistItem[] {
  const out: PlaylistItem[] = []
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const entry = m[1] ?? ''
    const youtubeId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]?.trim() ?? ''
    const title = decodeXml(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? '')
    const description = decodeXml(entry.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1]?.trim() ?? '')
    const item = { youtubeId, title, description: description || null }
    if (usable(item)) out.push(item)
  }
  return out
}

interface ApiPage {
  items?: { snippet?: { title?: string; description?: string; resourceId?: { videoId?: string } } }[]
  nextPageToken?: string
}

export interface FetchPlaylistOptions {
  /** مفتاح YouTube Data API v3: بدونه تُقرأ تغذية RSS (آخر 15 فيديو فقط) */
  apiKey?: string | undefined
  max?: number
  fetchImpl?: typeof fetch
}

/**
 * فيديوهات قائمة تشغيل بترتيبها. مع المفتاح: القائمة كاملة عبر الصفحات؛
 * بدونه: آخر 15 عبر RSS. الفيديوهات المحذوفة/الخاصة تُسقَط في الحالتين.
 */
export async function fetchPlaylistItems(playlistId: string, opts: FetchPlaylistOptions = {}): Promise<PlaylistItem[]> {
  const doFetch = opts.fetchImpl ?? fetch
  const max = Math.max(1, Math.min(opts.max ?? 200, 500))

  if (!opts.apiKey) {
    const res = await doFetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`)
    if (!res.ok) throw new Error(`YouTube RSS HTTP ${res.status}`)
    return parseRss(await res.text()).slice(0, max)
  }

  const out: PlaylistItem[] = []
  let pageToken: string | undefined
  // حدّ صريح للصفحات: قائمة ضخمة لا تستهلك الحصة كلها في طلب واحد
  for (let page = 0; page < 10 && out.length < max; page++) {
    const q = new URLSearchParams({ part: 'snippet', maxResults: '50', playlistId, key: opts.apiKey })
    if (pageToken) q.set('pageToken', pageToken)
    const res = await doFetch(`https://www.googleapis.com/youtube/v3/playlistItems?${q.toString()}`)
    if (!res.ok) throw new Error(`YouTube API HTTP ${res.status}`)
    const data = (await res.json()) as ApiPage
    for (const it of data.items ?? []) {
      const item = {
        youtubeId: it.snippet?.resourceId?.videoId?.trim() ?? '',
        title: (it.snippet?.title ?? '').trim(),
        description: (it.snippet?.description ?? '').trim() || null
      }
      if (usable(item) && out.length < max) out.push(item)
    }
    pageToken = data.nextPageToken
    if (!pageToken) break
  }
  return out
}
