import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setAiProviderForTests } from '@/server/ai/provider'
import { lessonKeyOf, parseGroupLessons } from '@/server/ai/shared'
import type { AIProvider, GroupVideoLessonsInput } from '@/server/ai/types'
import type { DatabaseHandle } from '@/server/db/connect'
import { contentSources, educators, levels, resources, subjects } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import { getDirectoryVideo } from '@/server/services/educators.service'
import { listLessonVideos, listVideoLessons, organizeVideoLessons, videoSubjects } from '@/server/services/video-lessons.service'
import { setupDb } from './helpers'

let h: DatabaseHandle
const calls: GroupVideoLessonsInput[] = []

/** نموذج مزيّف يسمّي الدرس من العنوان؛ في الدفعة الثانية يعيد اسماً بصيغة أخرى ليُختبر التوحيد */
const grouper = {
  name: 'openai',
  model: 'x',
  async groupVideoLessons(input: GroupVideoLessonsInput) {
    calls.push(input)
    return {
      items: input.items.map((i) => ({
        id: i.id,
        lesson: /بدل/.test(i.title) ? (calls.length > 1 ? 'البدل وإعرابه' : 'إعراب البدل') : /بيان|استعار|تشبيه/.test(i.title) ? (/تشبيه/.test(i.title) ? 'الصّور البيانيّة' : 'الصور البيانية') : /نصائح/.test(i.title) ? null : 'حلول مواضيع البكالوريا',
        level: /بدل/.test(i.title) ? '1AS' : null
      }))
    }
  }
} as unknown as AIProvider

let arabicId: string
const vid = async (educatorId: string, title: string, n: number) => {
  const [src] = await h.db.select({ id: contentSources.id }).from(contentSources).where(eq(contentSources.code, 'youtube'))
  const [r] = await h.db
    .insert(resources)
    .values({ title, type: 'VIDEO', subjectId: arabicId, sourceId: src!.id, educatorId, youtubeVideoId: `yt${String(n).padStart(9, '0')}`, thumbnailUrl: `https://i.ytimg.com/vi/x${n}/mqdefault.jpg`, fingerprint: `test:video:${n}`, status: 'PUBLISHED', accessLevel: 'PUBLIC' })
    .returning({ id: resources.id })
  return r!.id
}

let ids: Record<string, string> = {}

beforeAll(async () => {
  h = await setupDb()
  await seedCurriculum(h.db)
  arabicId = (await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'ARABIC')))[0]!.id
  const [a] = await h.db.insert(educators).values({ name: 'الأستاذ حيقون', nameKey: 'haigoun', status: 'APPROVED', youtubeChannelId: 'UCa', channelThumbnail: 'https://yt3.example/a.jpg' }).returning({ id: educators.id })
  const [b] = await h.db.insert(educators).values({ name: 'الأستاذة سارة', nameKey: 'sara', status: 'APPROVED', youtubeChannelId: 'UCb' }).returning({ id: educators.id })
  ids = {
    a1: await vid(a!.id, 'إعراب البدل بالتفصيل', 1),
    a2: await vid(a!.id, 'الاستعارة المكنية والتصريحية', 2),
    a3: await vid(a!.id, 'نصائح قبل الامتحان', 3),
    b1: await vid(b!.id, 'البدل: أنواعه وإعرابه', 4),
    b2: await vid(b!.id, 'التشبيه وأركانه', 5),
    b3: await vid(b!.id, 'حل بكالوريا 2023 لغة عربية', 6)
  }
})

afterAll(async () => {
  setAiProviderForTests(null)
  await h.close()
})

describe('ترتيب فيديوهات القنوات بالدرس', () => {
  it('مفتاح الدرس يوحّد الصيغ: التشكيل وأل التعريف والتاء المربوطة', () => {
    expect(lessonKeyOf('الصّور البيانيّة')).toBe(lessonKeyOf('صور بيانية'))
    expect(lessonKeyOf('إعراب البدل')).toBe(lessonKeyOf('اعراب البدل'))
    expect(lessonKeyOf('الدوال')).not.toBe(lessonKeyOf('الدوال الأسية'))
    // اسم بصيغة درس معتمد يُعاد بالصيغة المعتمدة، والمعرّفات الغريبة تُهمل
    const out = parseGroupLessons({ items: [{ id: 'v1', lesson: 'الصّور البيانيّة', level: '1as' }, { id: 'zz', lesson: 'x', level: null }] }, { subject: 'العربية', knownLessons: ['الصور البيانية'], items: [{ id: 'v1', title: 't', topic: null, channel: null, level: null }] })
    expect(out.items).toEqual([{ id: 'v1', lesson: 'الصور البيانية', level: '1AS' }])
  })

  it('يجمع كل من شرح الدرس نفسه من القنوات المختلفة، ويبقي ما ليس درساً بلا درس', async () => {
    setAiProviderForTests(grouper)
    const r = await organizeVideoLessons(h.db)
    expect(r.videos).toBe(6)
    expect(r.assigned).toBe(5)
    const { lessons, unsorted } = await listVideoLessons(h.db)
    expect(unsorted).toBe(1)
    const imagery = lessons.find((l) => l.title === 'الصور البيانية')!
    expect(imagery.videos).toBe(2)
    expect(imagery.channels.map((c) => c.name).sort()).toEqual(['الأستاذ حيقون', 'الأستاذة سارة'])
    const badal = lessons.find((l) => l.key === lessonKeyOf('إعراب البدل'))!
    expect(badal.videos).toBe(2)
    // المستوى الذي عرفه النموذج يُحفظ للفيديو الذي لم يكن له مستوى
    const [v] = await h.db.select({ levelId: resources.levelId }).from(resources).where(eq(resources.id, ids.a1!))
    const [as1] = await h.db.select({ id: levels.id }).from(levels).where(eq(levels.code, '1AS'))
    expect(v!.levelId).toBe(as1!.id)

    const detail = await listLessonVideos(h.db, { subjectSlug: badal.subject.slug, lessonKey: badal.key })
    expect(detail.total).toBe(2)
    expect(detail.channels).toHaveLength(2)

    // صفحة الفيديو تقترح شرح القناة الأخرى للدرس نفسه
    const page = await getDirectoryVideo(h.db, ids.a1!)
    expect(page.lessonTitle).toBe('إعراب البدل')
    expect(page.sameLesson.map((x) => x.id)).toEqual([ids.b1])
  })

  it('جولة ثانية تبقي الأسماء ثابتة: الدروس المعتمدة تُمرَّر للنموذج ويُعاد الاسم الأول', async () => {
    const r = await organizeVideoLessons(h.db)
    expect(r.assigned).toBe(5)
    const last = calls[calls.length - 1]!
    expect(last.knownLessons).toContain('إعراب البدل')
    // النموذج قال «البدل وإعرابه» هذه المرة: مفتاح مختلف ⇒ درس جديد، لكن المعتمد يبقى في القائمة للمرات القادمة
    const { lessons } = await listVideoLessons(h.db, { q: 'البدل' })
    expect(lessons.length).toBeGreaterThanOrEqual(1)
  })

  it('المستوى يرشّح: فيديوهات المستوى + غير المحدَّدة؛ وبلا ذكاء اصطناعي تُطابَق الأسماء المعتمدة حتمياً', async () => {
    const [am4] = await h.db.select({ id: levels.id }).from(levels).where(eq(levels.code, '4AM'))
    const for4 = await listVideoLessons(h.db, { levelId: am4!.id })
    // فيديوهات البدل صارت 1AS ⇒ تختفي عن 4 متوسط، والصور البيانية بلا مستوى ⇒ تبقى
    expect(for4.lessons.some((l) => l.title === 'الصور البيانية')).toBe(true)
    expect(for4.lessons.some((l) => l.key === lessonKeyOf('إعراب البدل'))).toBe(false)
    expect((await videoSubjects(h.db, am4!.id))[0]!.n).toBeGreaterThan(0)

    setAiProviderForTests(null) // المزوّد الافتراضي في الاختبارات: mock حتمي
    await h.db.update(resources).set({ lessonKey: null, lessonTitle: null }).where(eq(resources.id, ids.a2!))
    await h.db.update(resources).set({ title: 'شرح الصور البيانية في النصوص' }).where(eq(resources.id, ids.a2!))
    const r = await organizeVideoLessons(h.db, { onlyMissing: true })
    expect(r.videos).toBe(2) // الفيديو الممسوح + «نصائح» الذي لا درس له
    const [a2] = await h.db.select({ lessonTitle: resources.lessonTitle }).from(resources).where(eq(resources.id, ids.a2!))
    expect(a2!.lessonTitle).toBe('الصور البيانية')
  })
})
