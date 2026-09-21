import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { setAiProviderForTests } from '@/server/ai/provider'
import type { AIProvider, OrganizeLessonsInput } from '@/server/ai/types'
import { content } from '@/server/db/schema'
import { AppError } from '@/server/lib/errors'
import { importPlaylist } from '@/server/services/youtube-import.service'
import { makeAdmin, makeTeacher, setupDb } from './helpers'

const ids = ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc']

function apiFetch(videoIds: string[]): typeof fetch {
  const body = JSON.stringify({ items: videoIds.map((id) => ({ snippet: { title: `الحلقة 1 - درس ${id}`, description: 'وصف', resourceId: { videoId: id } } })) })
  return (async () => ({ ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body })) as unknown as typeof fetch
}

/** مزوّد يقلب الترتيب ويكتب عناوين عربية — للتحقق من أن ترتيبه هو ما يُحفظ */
const reversingProvider = (): AIProvider =>
  ({
    name: 'test-ai',
    model: 'x',
    async organizeLessons(input: OrganizeLessonsInput) {
      const reversed = [...input.items].reverse()
      return { lessons: reversed.map((i, n) => ({ youtubeId: i.youtubeId, title: `درس منظّم ${n + 1}`, summary: 'ملخّص', topic: 'المحور الأول', order: n + 1 })) }
    }
  }) as unknown as AIProvider

afterEach(() => setAiProviderForTests(null))

describe('استيراد قائمة تشغيل', () => {
  it('ينشئ درساً لكل فيديو بترتيب القائمة، بلا ذكاء اصطناعي', async () => {
    const h = await setupDb()
    try {
      const teacher = await makeTeacher(h.db, await makeAdmin(h.db))
      const r = await importPlaylist(h.db, teacher, { url: 'https://www.youtube.com/playlist?list=PLabcdefghij123', visibility: 'STUDENTS_ONLY' }, { apiKey: 'k', fetchImpl: apiFetch(ids) })
      expect(r).toMatchObject({ found: 3, imported: 3, skipped: 0, organizedBy: null })

      const rows = await h.db.select().from(content).where(eq(content.workspaceId, teacher.workspaceId!))
      expect(rows).toHaveLength(3)
      expect(rows.every((c) => c.type === 'VIDEO' && c.videoProvider === 'YOUTUBE')).toBe(true)
      expect(new Set(rows.map((c) => c.youtubeId))).toEqual(new Set(ids))
      // مسودّات ما لم يُطلب النشر: الأستاذ يراجع قبل أن يراها الطلاب
      expect(rows.every((c) => c.publishedAt === null)).toBe(true)
      // معرّفات فريدة رغم تشابه العناوين
      expect(new Set(rows.map((c) => c.slug)).size).toBe(3)
    } finally {
      await h.close()
    }
  })

  it('إعادة الاستيراد لا تُضاعف ما سبق', async () => {
    const h = await setupDb()
    try {
      const teacher = await makeTeacher(h.db, await makeAdmin(h.db))
      const opts = { apiKey: 'k', fetchImpl: apiFetch(ids) }
      const input = { url: 'PLabcdefghij123', visibility: 'STUDENTS_ONLY' as const }
      await importPlaylist(h.db, teacher, input, opts)
      const again = await importPlaylist(h.db, teacher, input, opts)
      expect(again).toMatchObject({ imported: 0, skipped: 3 })
      expect(await h.db.select().from(content).where(eq(content.workspaceId, teacher.workspaceId!))).toHaveLength(3)
    } finally {
      await h.close()
    }
  })

  it('مكتبة كل أستاذ مستقلة: نفس القائمة تُستورد لأستاذ آخر', async () => {
    const h = await setupDb()
    try {
      const admin = await makeAdmin(h.db)
      const a = await makeTeacher(h.db, admin, 'أ')
      const b = await makeTeacher(h.db, admin, 'ب')
      const opts = { apiKey: 'k', fetchImpl: apiFetch(ids) }
      await importPlaylist(h.db, a, { url: 'PLabcdefghij123', visibility: 'STUDENTS_ONLY' }, opts)
      const second = await importPlaylist(h.db, b, { url: 'PLabcdefghij123', visibility: 'STUDENTS_ONLY' }, opts)
      expect(second.imported).toBe(3)
    } finally {
      await h.close()
    }
  })

  it('مع التنظيم: ترتيب النموذج وعناوينه هي التي تُحفظ', async () => {
    const h = await setupDb()
    try {
      setAiProviderForTests(reversingProvider())
      const teacher = await makeTeacher(h.db, await makeAdmin(h.db))
      const r = await importPlaylist(
        h.db,
        teacher,
        { url: 'PLabcdefghij123', visibility: 'STUDENTS_ONLY', organize: true, publish: true },
        { apiKey: 'k', fetchImpl: apiFetch(ids) }
      )
      expect(r.organizedBy).toBe('test-ai')
      expect(r.titles).toEqual(['درس منظّم 1', 'درس منظّم 2', 'درس منظّم 3'])

      const rows = await h.db.select().from(content).where(eq(content.workspaceId, teacher.workspaceId!))
      const byTitle = new Map(rows.map((c) => [c.title, c]))
      expect(byTitle.get('درس منظّم 1')!.youtubeId).toBe('ccccccccccc')
      expect(byTitle.get('درس منظّم 1')!.topic).toBe('المحور الأول')
      expect(rows.every((c) => c.publishedAt !== null)).toBe(true)
    } finally {
      await h.close()
    }
  })

  it('فشل التنظيم لا يمنع الاستيراد', async () => {
    const h = await setupDb()
    try {
      setAiProviderForTests({ name: 'broken', model: 'x', async organizeLessons() { throw new Error('down') } } as unknown as AIProvider)
      const teacher = await makeTeacher(h.db, await makeAdmin(h.db))
      const r = await importPlaylist(h.db, teacher, { url: 'PLabcdefghij123', visibility: 'STUDENTS_ONLY', organize: true }, { apiKey: 'k', fetchImpl: apiFetch(ids) })
      expect(r).toMatchObject({ imported: 3, organizedBy: null })
    } finally {
      await h.close()
    }
  })

  it('رابط ليس قائمة، أو قائمة بلا فيديوهات صالحة: خطأ واضح بلا إنشاء شيء', async () => {
    const h = await setupDb()
    try {
      const teacher = await makeTeacher(h.db, await makeAdmin(h.db))
      await expect(importPlaylist(h.db, teacher, { url: 'https://youtube.com/watch?v=dQw4w9WgXcQ', visibility: 'PUBLIC' })).rejects.toBeInstanceOf(AppError)
      await expect(importPlaylist(h.db, teacher, { url: 'PLabcdefghij123', visibility: 'PUBLIC' }, { apiKey: 'k', fetchImpl: apiFetch([]) })).rejects.toThrow(/PLAYLIST_EMPTY|فيديوهات/)
      expect(await h.db.select().from(content).where(eq(content.workspaceId, teacher.workspaceId!))).toHaveLength(0)
    } finally {
      await h.close()
    }
  })
})
