import { describe, expect, it } from 'vitest'
import { bacExams } from '@/server/db/schema'
import { downloadLinks, extractLinks, streamOf, yearOf } from '@/server/bac/dzexams'
import { syncBacExams } from '@/server/bac/sync'
import { listBacExams } from '@/server/services/bac.service'
import { B, fakeSite, pages } from './fake-dzexams'
import { setupDb } from './helpers'

describe('روابط البكالوريات السابقة من DzExams', () => {
  it('يفهم الروابط والسنة والشعبة وروابط التنزيل', () => {
    const links = extractLinks(pages[`${B}/ar/bac`]!)
    expect(links.map((l) => l.text)).toEqual(['اللغة العربية وآدابها', 'الفيزياء', 'Arabe'])
    expect(yearOf('موضوع اللغة العربية – بكالوريا 2024')).toBe(2024)
    expect(streamOf('موضوع اللغة العربية شعبة ل.أ مع التصحيح – بكالوريا 2024')).toBe('ل.أ')
    const dl = downloadLinks(pages[`${B}/ar/annales/AAA111==`]!)
    expect(dl.examUrl).toBe('https://cdn.dzexams.com/bac/arabe-2024-lp.pdf')
    expect(dl.correctionUrl).toBe('https://www.dzexams.com/download/arabe-2024-lp-corrige.pdf')
    expect(downloadLinks(pages[`${B}/ar/annales/BBB222==`]!).examUrl).toBe('https://cdn.dzexams.com/viewer/bac-2019-arabe.pdf')
  })

  it('يزحف المواد والشعب والترقيم، يحفظ روابط لا ملفات، ولا يكرّر', async () => {
    const h = await setupDb()
    try {
      const r = await syncBacExams(h.db, { fetch: fakeSite, delayMs: 0 })
      expect(r).toMatchObject({ subjects: 2, found: 2, saved: 2, withDirectLink: 2 })
      const rows = await h.db.select().from(bacExams)
      const lp = rows.find((x) => x.year === 2024)!
      expect(lp).toMatchObject({ subjectSlug: 'arabe', streamSlug: 'lp', streamName: 'شعبة آداب وفلسفة', correctionUrl: 'https://www.dzexams.com/download/arabe-2024-lp-corrige.pdf' })
      // مرّة ثانية: لا زيارة للمحفوظ ولا تكرار
      const again = await syncBacExams(h.db, { fetch: fakeSite, delayMs: 0 })
      expect(again.saved).toBe(0)
      expect(await h.db.select().from(bacExams)).toHaveLength(2)

      const list = await listBacExams(h.db, { subject: 'arabe' })
      expect(list.exams.map((e) => e.year)).toEqual([2024, 2019])
      expect(list.subjects).toEqual([{ slug: 'arabe', name: 'اللغة العربية وآدابها', count: 2 }])
    } finally {
      await h.close()
    }
  })
})
