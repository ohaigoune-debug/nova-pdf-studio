import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { levels, notifications, subjects } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { createThread, deletePost, deleteThread, getThread, listThreads, moderateThread, replyToThread } from '@/server/services/forum.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let student: Actor
let other: Actor
let level3AS: string
let level4AM: string
let arabic: string

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'الأستاذ حيقون')
  // تلميذ لم ينضمّ إلى أيّ أستاذ بكود: يكتب في المنتدى مع ذلك
  student = await makeStudent(h.db, 'تلميذ بلا كود')
  other = await makeStudent(h.db, 'تلميذ آخر')
  level3AS = (await h.db.select({ id: levels.id }).from(levels).where(eq(levels.code, '3AS')))[0]!.id
  level4AM = (await h.db.insert(levels).values({ code: '4AM', nameAr: 'السنة الرابعة متوسط', sortOrder: 9 }).returning({ id: levels.id }))[0]!.id
  arabic = (await h.db.insert(subjects).values({ code: 'ARABIC', slug: 'arabic', nameAr: 'اللغة العربية', nameFr: 'Arabe', sortOrder: 1 }).returning({ id: subjects.id }))[0]!.id
})

afterAll(async () => {
  await h.close()
})

const code = async (fn: () => Promise<unknown>) => {
  try {
    await fn()
    return null
  } catch (e) {
    return e instanceof AppError ? e.code : String(e)
  }
}

describe('المنتدى', () => {
  it('تلميذ بلا كود أستاذ يطرح موضوعاً، والأستاذ يجيب، وصاحب الموضوع يُشعَر', async () => {
    const t = await createThread(h.db, student, { title: 'كيف أُعرب البدل؟', body: 'في جملة «جاء الطالبُ محمدٌ» ما إعراب محمد؟', subjectId: arabic, levelId: level3AS })
    const r = await replyToThread(h.db, teacher, t.id, 'محمدٌ: بدل مطابق مرفوع وعلامة رفعه الضمة.')
    const view = await getThread(h.db, null, t.id)
    expect(view.title).toBe('كيف أُعرب البدل؟')
    expect(view.repliesCount).toBe(1)
    expect(view.posts[0]!.author.badge).toBe('أستاذ')
    expect(view.canReply).toBe(false) // الزائر يقرأ ولا يكتب
    const notes = await h.db.select().from(notifications).where(eq(notifications.userId, student.userId))
    expect(notes.some((n) => n.link === `/forum/${t.id}#p-${r.id}`)).toBe(true)
  })

  it('المستوى يرشّح المواضيع، والموضوع بلا مستوى يظهر للجميع', async () => {
    await createThread(h.db, other, { title: 'سؤال عن شهادة التعليم المتوسط', body: 'نصيحة للمراجعة؟', levelId: level4AM })
    await createThread(h.db, other, { title: 'سؤال عامّ لكل المستويات', body: 'كيف أنظّم وقتي؟' })
    const for4 = await listThreads(h.db, null, { levelId: level4AM })
    const titles4 = for4.items.map((t) => t.title)
    expect(titles4).toContain('سؤال عن شهادة التعليم المتوسط')
    expect(titles4).toContain('سؤال عامّ لكل المستويات')
    expect(titles4).not.toContain('كيف أُعرب البدل؟')
    const forSubject = await listThreads(h.db, null, { subjectId: arabic })
    expect(forSubject.items.map((t) => t.title)).toEqual(['كيف أُعرب البدل؟'])
  })

  it('لا يحذف أحد إلا ما كتبه، والمشرف يحذف كل شيء', async () => {
    const t = await createThread(h.db, student, { title: 'موضوع للحذف', body: 'نصّ تجريبي' })
    const p = await replyToThread(h.db, other, t.id, 'ردّ تلميذ آخر')
    expect(await code(() => deleteThread(h.db, other, t.id))).toBe('FORBIDDEN')
    expect(await code(() => deletePost(h.db, student, p.id))).toBe('FORBIDDEN')
    await deletePost(h.db, other, p.id)
    expect((await getThread(h.db, null, t.id)).repliesCount).toBe(0)
    await deleteThread(h.db, admin, t.id)
    expect(await code(() => getThread(h.db, null, t.id))).toBe('NOT_FOUND')
  })

  it('القفل يمنع الردود والإخفاء يُبعد الموضوع عن الزوار؛ الإشراف للمشرف وحده', async () => {
    const t = await createThread(h.db, student, { title: 'موضوع يُقفل', body: 'نصّ' })
    expect(await code(() => moderateThread(h.db, teacher, t.id, 'lock'))).toBe('FORBIDDEN')
    await moderateThread(h.db, admin, t.id, 'lock')
    expect(await code(() => replyToThread(h.db, other, t.id, 'ردّ'))).toBe('FORBIDDEN')
    await moderateThread(h.db, admin, t.id, 'hide')
    expect(await code(() => getThread(h.db, other, t.id))).toBe('NOT_FOUND')
    expect((await getThread(h.db, admin, t.id)).status).toBe('HIDDEN')
    expect((await listThreads(h.db, null)).items.some((x) => x.id === t.id)).toBe(false)
  })

  it('التثبيت يرفع الموضوع إلى الأعلى، والترقيم لا يكرّر ولا يُسقط', async () => {
    const pinned = await createThread(h.db, other, { title: 'قواعد المنتدى', body: 'احترموا بعضكم.' })
    await moderateThread(h.db, admin, pinned.id, 'pin')
    for (let i = 0; i < 5; i++) await createThread(h.db, admin, { title: `موضوع رقم ${i + 1}`, body: 'نصّ' })
    const page1 = await listThreads(h.db, null, {}, { limit: 3 })
    expect(page1.items[0]!.id).toBe(pinned.id)
    const seen = new Set(page1.items.map((t) => t.id))
    let cursor = page1.nextCursor
    while (cursor) {
      const next = await listThreads(h.db, null, {}, { cursor, limit: 3 })
      for (const t of next.items) {
        expect(seen.has(t.id)).toBe(false)
        seen.add(t.id)
      }
      cursor = next.nextCursor
    }
    const all = await listThreads(h.db, null, {}, { limit: 50 })
    expect(seen.size).toBe(all.items.length)
  })

  it('يرفض النصوص القصيرة جداً وحدّ المواضيع في الساعة', async () => {
    expect(await code(() => createThread(h.db, student, { title: 'ab', body: 'نصّ كافٍ' }))).toBe('VALIDATION')
    const flood = await makeStudent(h.db, 'تلميذ مستعجل')
    for (let i = 0; i < 6; i++) await createThread(h.db, flood, { title: `سؤال سريع ${i}`, body: 'نصّ' })
    expect(await code(() => createThread(h.db, flood, { title: 'سؤال سابع', body: 'نصّ' }))).toBe('RATE_LIMITED')
  })
})
