/**
 * صفحات الهبوط (17 نوفمبر 2026): الإنشاء من الدورة، التحقق من المدخلات، العرض العام والمعاينة،
 * عدّ الزيارات، ونسبة الطلب إلى الصفحة والمصدر، و«أكمل طلب دورتك».
 */
import { readFileSync } from 'node:fs'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { orders } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { placeCourseOrder, setCourseBook } from '@/server/services/course-purchase.service'
import { createCourse, setCourseStatus } from '@/server/services/courses.service'
import {
  attributionFromCookie,
  createLandingForCourse,
  landingBySlug,
  landingResumeFor,
  landingStats,
  normalizeSlug,
  normalizeSource,
  recordLandingVisit,
  updateLanding,
  videoEmbedUrl
} from '@/server/services/landing.service'
import { makeAdmin, makeStudent, makeTeacher, refIds, setupDb, workspaceIdOfTeacher } from './helpers'

describe('القواعد الصافية', () => {
  it('الرابط: لاتيني صغير وأرقام وشرطة', () => {
    expect(normalizeSlug(' BAC 2027 ')).toBe('bac-2027')
    expect(normalizeSlug('bac_2027')).toBe('bac-2027')
    expect(normalizeSlug('بكالوريا')).toBeNull()
    expect(normalizeSlug('a')).toBeNull()
  })
  it('المصدر: رمز قصير وإلا «مباشر»', () => {
    expect(normalizeSource('IG')).toBe('ig')
    expect(normalizeSource('ecole-bousaada')).toBe('ecole-bousaada')
    expect(normalizeSource('<script>')).toBe('direct')
    expect(normalizeSource(null)).toBe('direct')
  })
  it('الفيديو: يوتيوب وShorts وBunny فقط، برابط تضمين آمن', () => {
    expect(videoEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(videoEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3')).toContain('/embed/dQw4w9WgXcQ')
    expect(videoEmbedUrl('https://youtube.com/shorts/dQw4w9WgXcQ')).toContain('/embed/dQw4w9WgXcQ')
    expect(videoEmbedUrl('https://iframe.mediadelivery.net/play/12345/0b5e7f7a-1111-2222-3333-444455556666')).toBe('https://iframe.mediadelivery.net/embed/12345/0b5e7f7a-1111-2222-3333-444455556666?autoplay=false&preload=false&responsive=true')
    expect(videoEmbedUrl('https://evil.example/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(videoEmbedUrl('http://youtu.be/dQw4w9WgXcQ')).toBeNull()
    expect(videoEmbedUrl('javascript:alert(1)')).toBeNull()
  })
})

describe('صفحة هبوط حقيقية', () => {
  let h: DatabaseHandle
  let admin: Actor
  let workspaceId: string
  let wilayaId: string
  let n = 0

  beforeAll(async () => {
    h = await setupDb()
    admin = await makeAdmin(h.db)
    const teacher = await makeTeacher(h.db, admin, 'أستاذ الهبوط')
    workspaceId = await workspaceIdOfTeacher(h.db, teacher)
    wilayaId = (await refIds(h.db)).wilayaId!
  })

  afterAll(async () => {
    await h.close()
  })

  async function course() {
    const c = await createCourse(h.db, admin, { title: `دورة الهبوط ${++n}`, workspaceId, season: '2026/2027', status: 'DRAFT' })
    await setCourseBook(h.db, admin, c.id, { title: `كتاب ${n}`, priceDzd: 5900, stock: null, active: true })
    await setCourseStatus(h.db, admin, c.id, 'PUBLISHED')
    return c
  }
  const input = (slug: string, extra: Partial<Parameters<typeof updateLanding>[3]> = {}) => ({ slug, headline: 'العرض السنوي — بكالوريا 2027', subheadline: null, videoUrl: null, bullets: ['حصص مباشرة'], about: null, faq: [], active: true, ...extra })

  it('الزر ينشئ صفحة متوقفة برابط من الموسم، ورابطًا آخر إن تكرّر', async () => {
    const c = await course()
    const a = await createLandingForCourse(h.db, admin, c.id)
    const b = await createLandingForCourse(h.db, admin, c.id)
    expect(a.slug).toBe('bac2027')
    expect(b.slug).toBe('bac2027-2')
    expect(a.active).toBe(false)
    expect(a.bullets.length).toBeGreaterThan(3)
    const s = await makeStudent(h.db, 'تلميذ فضولي')
    await expect(createLandingForCourse(h.db, s, c.id)).rejects.toThrow()
  })

  it('المتوقفة لا تظهر إلا في المعاينة، والمشغّلة تظهر للجميع', async () => {
    const c = await course()
    const l = await createLandingForCourse(h.db, admin, c.id)
    expect(await landingBySlug(h.db, l.slug)).toBeNull()
    expect((await landingBySlug(h.db, l.slug, { preview: true }))?.id).toBe(l.id)
    await updateLanding(h.db, admin, l.id, input(l.slug))
    expect((await landingBySlug(h.db, l.slug))?.courseSlug).toBe(c.slug)
  })

  it('التحقق: رابط فاسد أو مكرّر، فيديو من موقع آخر، وأسئلة بلا جواب لا تُحفظ', async () => {
    const c = await course()
    const l = await createLandingForCourse(h.db, admin, c.id)
    await expect(updateLanding(h.db, admin, l.id, input('بكالوريا'))).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(updateLanding(h.db, admin, l.id, input('bac2027'))).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(updateLanding(h.db, admin, l.id, input(l.slug, { videoUrl: 'https://evil.example/v.mp4' }))).rejects.toMatchObject({ code: 'VALIDATION' })
    const saved = await updateLanding(h.db, admin, l.id, input('ramadan-offer', { faq: [{ q: 'متى؟', a: 'في جانفي' }, { q: 'بلا جواب', a: ' ' }], bullets: ['أ', '', ' ب '] }))
    expect(saved.slug).toBe('ramadan-offer')
    expect(saved.faq).toEqual([{ q: 'متى؟', a: 'في جانفي' }])
    expect(saved.bullets).toEqual(['أ', 'ب'])
  })

  it('الزيارات تُعدّ لكل مصدر، والطلب يُنسب إلى الصفحة ومصدرها، و«أكمل طلبك» يختفي بعد الطلب', async () => {
    const c = await course()
    const l = await createLandingForCourse(h.db, admin, c.id)
    await updateLanding(h.db, admin, l.id, input(`go-${n}`))
    await recordLandingVisit(h.db, l.id, 'ig')
    await recordLandingVisit(h.db, l.id, 'ig')
    await recordLandingVisit(h.db, l.id, 'yt')
    const s = await makeStudent(h.db, 'تلميذ من إنستغرام')
    const cookie = `${l.id}:ig`
    expect(await attributionFromCookie(h.db, cookie)).toEqual({ landingId: l.id, source: 'ig' })
    expect(await attributionFromCookie(h.db, 'not-a-uuid:ig')).toBeNull()
    expect(await landingResumeFor(h.db, s, cookie)).toEqual({ courseTitle: c.title, href: `/student/courses/${c.slug}/order` })
    const o = await placeCourseOrder(h.db, s, { courseId: c.id, phone: '0661999001', wilayaId, address: 'حي النصر', deliveryType: 'HOME', attribution: await attributionFromCookie(h.db, cookie) } as Parameters<typeof placeCourseOrder>[2])
    const [row] = await h.db.select({ landingId: orders.landingId, src: orders.trafficSource }).from(orders).where(eq(orders.id, o.id))
    expect(row).toEqual({ landingId: l.id, src: 'ig' })
    expect(await landingResumeFor(h.db, s, cookie)).toBeNull()
    const stats = (await landingStats(h.db, admin, [l.id])).get(l.id)!
    expect(stats.find((x) => x.source === 'ig')).toMatchObject({ visits: 2, orders: 1, delivered: 0, label: 'إنستغرام' })
    expect(stats.find((x) => x.source === 'yt')).toMatchObject({ visits: 1, orders: 0 })
  })

  it('الصفحة العامة: عدّاد الزيارة يعمل من المتصفح، ولا عدّ في المعاينة، والطلبات تحمل شارة الصفحة في الإدارة', () => {
    const page = readFileSync('src/app/go/[slug]/page.tsx', 'utf8')
    expect(page).toContain('<LandingBeacon slug={landing.slug} src={sp.src ?? null} preview={preview} />')
    expect(page).toContain("actor?.role === 'SUPER_ADMIN'")
    const beacon = readFileSync('src/components/landing/landing-beacon.tsx', 'utf8')
    expect(beacon).toContain('if (preview) return')
    const route = readFileSync('src/app/api/landing/visit/route.ts', 'utf8')
    expect(route).toContain('httpOnly: true')
    expect(readFileSync('src/app/admin/store/confirm/page.tsx', 'utf8')).toContain('o.landingSlug')
    expect(readFileSync('src/server/actions/course-purchase.actions.ts', 'utf8')).toContain('attributionFromCookie')
  })
})
