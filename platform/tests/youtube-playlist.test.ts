import { describe, expect, it } from 'vitest'
import { parseOrganize } from '@/server/ai/shared'
import { fetchPlaylistItems, parsePlaylistId } from '@/server/lib/youtube'

const rss = (entries: string) => `<?xml version="1.0"?><feed>${entries}</feed>`
const entry = (id: string, title: string, desc = '') =>
  `<entry><yt:videoId>${id}</yt:videoId><title>${title}</title><media:group><media:description>${desc}</media:description></media:group></entry>`

function fetchOnce(body: string, ok = true): typeof fetch {
  return (async () => ({ ok, status: ok ? 200 : 404, text: async () => body, json: async () => JSON.parse(body) })) as unknown as typeof fetch
}

describe('قوائم تشغيل يوتيوب', () => {
  it('يقرأ المعرّف من الرابط ويرفض ما ليس قائمة', () => {
    expect(parsePlaylistId('https://www.youtube.com/playlist?list=PLabcdefghij123')).toBe('PLabcdefghij123')
    expect(parsePlaylistId('https://youtube.com/watch?v=dQw4w9WgXcQ&list=UUabcdefghij123')).toBe('UUabcdefghij123')
    expect(parsePlaylistId('PLabcdefghij123')).toBe('PLabcdefghij123')
    // قائمة مزج يولّدها يوتيوب لكل مشاهد: لا تُقرأ عبر الواجهة
    expect(parsePlaylistId('https://www.youtube.com/watch?v=x&list=RDabcdefghij123')).toBeNull()
    expect(parsePlaylistId('https://vimeo.com/playlist?list=PLabcdefghij123')).toBeNull()
    expect(parsePlaylistId('')).toBeNull()
  })

  it('RSS: يحافظ على الترتيب ويُسقط المحذوف والخاص ويفكّ ترميز XML', async () => {
    const xml = rss([entry('aaaaaaaaaaa', 'الدرس الأول'), entry('bbbbbbbbbbb', 'Private video'), entry('ccccccccccc', 'Deleted video'), entry('ddddddddddd', 'المقال &amp; الحجاج', 'وصف &quot;مقتبس&quot;')].join(''))
    const items = await fetchPlaylistItems('PLabcdefghij123', { fetchImpl: fetchOnce(xml) })
    expect(items.map((i) => i.youtubeId)).toEqual(['aaaaaaaaaaa', 'ddddddddddd'])
    expect(items[1]!.title).toBe('المقال & الحجاج')
    expect(items[1]!.description).toBe('وصف "مقتبس"')
  })

  it('واجهة البيانات: يتبع الصفحات ويتوقف عند الحدّ المطلوب', async () => {
    const page = (ids: string[], next?: string) =>
      JSON.stringify({ items: ids.map((id) => ({ snippet: { title: `درس ${id}`, description: '', resourceId: { videoId: id } } })), ...(next ? { nextPageToken: next } : {}) })
    const pages = [page(['a1111111111', 'a2222222222'], 'p2'), page(['b1111111111'])]
    let n = 0
    const fetchImpl = (async () => {
      const body = pages[n++] ?? pages[pages.length - 1]!
      return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body }
    }) as unknown as typeof fetch
    const items = await fetchPlaylistItems('PLabcdefghij123', { apiKey: 'k', fetchImpl })
    expect(items.map((i) => i.youtubeId)).toEqual(['a1111111111', 'a2222222222', 'b1111111111'])

    n = 0
    const limited = await fetchPlaylistItems('PLabcdefghij123', { apiKey: 'k', max: 2, fetchImpl })
    expect(limited).toHaveLength(2)
  })

  it('فشل الشبكة يظهر خطأً لا قائمة فارغة', async () => {
    await expect(fetchPlaylistItems('PLabcdefghij123', { fetchImpl: fetchOnce('', false) })).rejects.toThrow(/404/)
  })
})

describe('حراسة مخرجات التنظيم', () => {
  const items = [
    { youtubeId: 'aaaaaaaaaaa', title: 'الأول', description: null },
    { youtubeId: 'bbbbbbbbbbb', title: 'الثاني', description: null },
    { youtubeId: 'ccccccccccc', title: 'الثالث', description: null }
  ]
  const input = { playlistTitle: null, levelName: null, streamName: null, items }

  it('يرتّب حسب order ويُرقّم من 1', () => {
    const out = parseOrganize(
      {
        lessons: [
          { youtube_id: 'ccccccccccc', title: 'ج', summary: 's', topic: 'محور', order: 1 },
          { youtube_id: 'aaaaaaaaaaa', title: 'أ', summary: 's', topic: null, order: 2 },
          { youtube_id: 'bbbbbbbbbbb', title: 'ب', summary: 's', topic: null, order: 3 }
        ]
      },
      input
    )
    expect(out.lessons.map((l) => [l.youtubeId, l.order])).toEqual([
      ['ccccccccccc', 1],
      ['aaaaaaaaaaa', 2],
      ['bbbbbbbbbbb', 3]
    ])
  })

  it('معرّف مخترع يُرفض، ومكرّر يُهمل، ودرس أسقطه النموذج يُلحق بعنوانه الأصلي', () => {
    const out = parseOrganize(
      {
        lessons: [
          { youtube_id: 'zzzzzzzzzzz', title: 'مخترع', summary: '', topic: null, order: 1 },
          { youtube_id: 'aaaaaaaaaaa', title: 'أ', summary: '', topic: null, order: 2 },
          { youtube_id: 'aaaaaaaaaaa', title: 'أ مكرر', summary: '', topic: null, order: 3 }
        ]
      },
      input
    )
    expect(out.lessons.map((l) => l.youtubeId)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc'])
    expect(out.lessons[1]!.title).toBe('الثاني')
    expect(out.lessons.map((l) => l.order)).toEqual([1, 2, 3])
  })

  it('ردّ فارغ تماماً يُرجع القائمة كما هي', () => {
    const out = parseOrganize({}, input)
    expect(out.lessons.map((l) => l.youtubeId)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc'])
  })
})
