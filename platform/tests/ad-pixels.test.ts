/**
 * بكسلات الإعلانات (17 نوفمبر 2026): معطّلة دون معرّف، لا بيانات شخصية، المعرّفات مفحوصة قبل إدراجها،
 * وتعمل على صفحات الهبوط وما بعد الطلب فقط (CSP)، و«الطلب» يُبلَّغ مرة برقمه.
 */
import { readFileSync } from 'node:fs'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { orders } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { cleanMetaPixel, cleanTiktokPixel, isPixelPath, pixelScript, pixelsEnabled } from '@/lib/ad-pixels'
import { loadAdPixels, recentLandingConversions, setAdPixels } from '@/server/services/ad-pixels.service'
import { placeCourseOrder, setCourseBook } from '@/server/services/course-purchase.service'
import { createCourse, setCourseStatus } from '@/server/services/courses.service'
import { createLandingForCourse } from '@/server/services/landing.service'
import { makeAdmin, makeStudent, makeTeacher, refIds, setupDb, workspaceIdOfTeacher } from './helpers'

describe('السكربت', () => {
  it('لا معرّف = لا سكربت', () => {
    expect(pixelScript({ meta: '', tiktok: '' }, [])).toBeNull()
    expect(pixelsEnabled({ meta: '', tiktok: '' })).toBe(false)
  })

  it('يرفض أي معرّف غير صالح (لا حقن في السكربت)', () => {
    expect(cleanMetaPixel("123');alert(1);//")).toBeNull()
    expect(cleanMetaPixel('12345')).toBeNull()
    expect(cleanMetaPixel(' 1234 5678 9012 345 ')).toBe('123456789012345')
    expect(cleanTiktokPixel('c1a2b3c4d5e6f7g8h9i0')).toBe('C1A2B3C4D5E6F7G8H9I0')
    expect(cleanTiktokPixel('C1A2"</script>')).toBeNull()
    expect(pixelScript({ meta: "1');alert(1)//", tiktok: '' }, [])).toBeNull()
  })

  it('Meta وTikTok: زيارة، ومحتوى، وطلب برقمه ومبلغه — دون أي بيان شخصي', () => {
    const s = pixelScript({ meta: '123456789012345', tiktok: 'C1A2B3C4D5E6F7G8H9I0' }, [
      { name: 'ViewContent', contentName: 'bac2027' },
      { name: 'Purchase', valueDzd: 5900.4, orderNumber: 'MD-0042' }
    ])!
    expect(s).toContain(`fbq('init',"123456789012345");fbq('track','PageView');`)
    expect(s).toContain(`ttq.load("C1A2B3C4D5E6F7G8H9I0");ttq.page();`)
    expect(s).toContain(`fbq('track','ViewContent',{"content_name":"bac2027"});`)
    expect(s).toContain(`fbq('track','Purchase',{"value":5900,"currency":"DZD"},{"eventID":"MD-0042"});`)
    expect(s).toContain(`ttq.track('PlaceAnOrder',{"value":5900,"currency":"DZD","content_type":"product"},{"event_id":"MD-0042"});`)
    expect(s).toContain('[data-ad-cta]')
    expect(s).not.toMatch(/phone|email|full_?name|"ph"|"em"|advanced_matching/i)
  })

  it('Meta وحده: لا شيء من TikTok', () => {
    const s = pixelScript({ meta: '123456789012345', tiktok: '' }, [])!
    expect(s).toContain('fbevents.js')
    expect(s).not.toContain('ttq')
  })

  it('سياسة أمن المحتوى: أصول البكسل على صفحات الهبوط وما بعد الطلب وحدها', () => {
    expect(isPixelPath('/go/bac2027')).toBe(true)
    expect(isPixelPath('/student/courses/orders')).toBe(true)
    expect(isPixelPath('/student/payments/return')).toBe(true)
    expect(isPixelPath('/student')).toBe(false)
    expect(isPixelPath('/admin/landing')).toBe(false)
    const mw = readFileSync('src/middleware.ts', 'utf8')
    expect(mw).toContain('buildCsp(nonce, isPixelPath(pathname))')
  })

  it('صفحة الخصوصية تذكر البكسل بصدق', () => {
    const p = readFileSync('src/app/(public)/privacy/page.tsx', 'utf8')
    expect(p).toContain('Meta وTikTok (قياس الإعلانات)')
    expect(p).not.toContain('لا نستعمل كوكيز إعلانية ولا أدوات تتبّع من طرف ثالث.')
  })
})

describe('الإعداد والطلبات', () => {
  let h: DatabaseHandle
  let admin: Actor
  let workspaceId: string
  let wilayaId: string

  beforeAll(async () => {
    h = await setupDb()
    admin = await makeAdmin(h.db)
    const teacher = await makeTeacher(h.db, admin, 'أستاذ البكسل')
    workspaceId = await workspaceIdOfTeacher(h.db, teacher)
    wilayaId = (await refIds(h.db)).wilayaId!
  })

  afterAll(async () => {
    await h.close()
  })

  it('المشرف وحده يحفظ المعرّفات، والفارغ يعطّل، والخاطئ يُرفض', async () => {
    expect(await loadAdPixels(h.db)).toEqual({ meta: '', tiktok: '' })
    await setAdPixels(h.db, admin, { meta: '123456789012345', tiktok: '' })
    expect(await loadAdPixels(h.db)).toEqual({ meta: '123456789012345', tiktok: '' })
    await expect(setAdPixels(h.db, admin, { meta: 'abc', tiktok: '' })).rejects.toMatchObject({ code: 'VALIDATION' })
    const s = await makeStudent(h.db, 'تلميذ فضولي')
    await expect(setAdPixels(h.db, s, { meta: '', tiktok: '' })).rejects.toThrow()
    await setAdPixels(h.db, admin, { meta: '', tiktok: '' })
    expect(await loadAdPixels(h.db)).toEqual({ meta: '', tiktok: '' })
  })

  it('«طلب» يُبلَّغ لطلب جاء من صفحة هبوط فقط، وليس للملغى ولا للطلب العادي', async () => {
    const c = await createCourse(h.db, admin, { title: 'دورة البكسل', workspaceId, season: '2026/2027', status: 'DRAFT' })
    await setCourseBook(h.db, admin, c.id, { title: 'كتاب البكسل', priceDzd: 5900, stock: null, active: true })
    await setCourseStatus(h.db, admin, c.id, 'PUBLISHED')
    const l = await createLandingForCourse(h.db, admin, c.id)
    const s = await makeStudent(h.db, 'تلميذ من إعلان')
    const order = (attribution: { landingId: string; source: string } | null) =>
      placeCourseOrder(h.db, s, { courseId: c.id, phone: '0661777001', wilayaId, address: 'حي النصر', deliveryType: 'HOME', attribution } as Parameters<typeof placeCourseOrder>[2])
    const o = await order({ landingId: l.id, source: 'tt' })
    expect(await recentLandingConversions(h.db, s.userId)).toEqual([{ name: 'Purchase', valueDzd: o.totalDzd, orderNumber: o.number }])
    await h.db.update(orders).set({ status: 'CANCELLED' }).where(eq(orders.id, o.id))
    expect(await recentLandingConversions(h.db, s.userId)).toEqual([])
    const other = await makeStudent(h.db, 'تلميذ دون إعلان')
    await placeCourseOrder(h.db, other, { courseId: c.id, phone: '0661777002', wilayaId, address: 'حي النصر', deliveryType: 'HOME' } as Parameters<typeof placeCourseOrder>[2])
    expect(await recentLandingConversions(h.db, other.userId)).toEqual([])
  })

  it('بعد ساعتين لا يُعاد الإبلاغ', async () => {
    const s = await makeStudent(h.db, 'تلميذ قديم')
    expect(await recentLandingConversions(h.db, s.userId, new Date(Date.now() + 3 * 60 * 60 * 1000))).toEqual([])
  })
})
