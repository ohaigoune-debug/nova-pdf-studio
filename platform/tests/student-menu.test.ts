/** إخفاء أقسام حساب التلميذ من الإدارة (1 نوفمبر 2026) */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { activeEntry, cleanHiddenEntries, expandHidden, isPathHidden } from '@/lib/student-menu'
import { getHiddenStudentEntries, setHiddenStudentEntries } from '@/server/services/student-menu.service'
import { makeAdmin, makeStudent, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
})
afterAll(async () => {
  await h.close()
})

describe('أقسام حساب التلميذ', () => {
  it('إخفاء «الفروض» كقسم يخفي تبويبيه وصفحاتهما، ولا يمسّ غيره', () => {
    const x = expandHidden(['/student/exams'])
    expect(isPathHidden('/student/exams', x)).toBe(true)
    expect(isPathHidden('/student/assignments/abc', x)).toBe(true)
    expect(isPathHidden('/student/lessons', x)).toBe(false)
    expect(isPathHidden('/student', x)).toBe(false)
  })

  it('إخفاء «دوراتي» لا يمنع التلميذ من صفحة دورة يملكها ولا من دروسها؛ «حسابي» و«الرئيسية» لا تُخفيان', () => {
    const x = expandHidden(['/student/courses'])
    expect(isPathHidden('/student/courses', x)).toBe(true)
    expect(isPathHidden('/student/courses/ma-dawra', x)).toBe(false)
    expect(isPathHidden('/student/lessons/dars-1', x)).toBe(false)
    expect(isPathHidden('/student/classroom', x)).toBe(true)
    // «الكتب والدورات» مدخل مستقل منذ 21 نوفمبر 2026
    expect(isPathHidden('/student/courses/catalog', x)).toBe(false)
    expect(cleanHiddenEntries(['/student', '/student/profile', '/admin', '/student/files', '/student/support'])).toEqual(['/student/support'])
  })

  it('«الكتب والدورات» يُخفى مع «طلباتي»، والمسار القديم المحفوظ يبقى صالحًا', () => {
    const x = expandHidden(['/student/courses/catalog'])
    expect(isPathHidden('/student/courses/catalog', x)).toBe(true)
    expect(isPathHidden('/student/courses/orders', x)).toBe(true)
    expect(isPathHidden('/student/courses', x)).toBe(false)
  })

  it('المدخل النشط صاحب أطول مسار مطابق: «الكتب والدورات» لا يُضيء «دوراتي»', () => {
    const entries = [
      { id: 'home', paths: ['/student'], exact: true },
      { id: 'courses', paths: ['/student/courses', '/student/lessons', '/student/classroom'] },
      { id: 'shop', paths: ['/student/courses/catalog', '/student/courses/orders'] }
    ]
    expect(activeEntry('/student', entries)).toBe('home')
    expect(activeEntry('/student/courses', entries)).toBe('courses')
    expect(activeEntry('/student/courses/ma-dawra', entries)).toBe('courses')
    expect(activeEntry('/student/lessons/dars', entries)).toBe('courses')
    expect(activeEntry('/student/courses/catalog', entries)).toBe('shop')
    expect(activeEntry('/student/courses/orders', entries)).toBe('shop')
    expect(activeEntry('/student/support', entries)).toBeNull()
  })

  it('المشرف وحده يحفظ، والقيمة تُقرأ كما حُفظت', async () => {
    await setHiddenStudentEntries(h.db, admin, ['/student/exams', '/bac', '/x'])
    expect(await getHiddenStudentEntries(h.db)).toEqual(['/student/exams', '/bac'])
    const s = await makeStudent(h.db)
    await expect(setHiddenStudentEntries(h.db, s, [])).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'FORBIDDEN')
  })
})
