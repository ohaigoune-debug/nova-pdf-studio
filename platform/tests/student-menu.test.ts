/** إخفاء أقسام حساب التلميذ من الإدارة (1 نوفمبر 2026) */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { cleanHiddenEntries, expandHidden, isPathHidden } from '@/lib/student-menu'
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

  it('إخفاء «الدورات» لا يمنع التلميذ من صفحة دورة يملكها؛ «حسابي» و«الرئيسية» لا تُخفيان', () => {
    const x = expandHidden(['/student/courses'])
    expect(isPathHidden('/student/courses/catalog', x)).toBe(true)
    expect(isPathHidden('/student/courses/ma-dawra', x)).toBe(false)
    expect(cleanHiddenEntries(['/student', '/student/profile', '/admin', '/student/files'])).toEqual(['/student/files'])
  })

  it('المشرف وحده يحفظ، والقيمة تُقرأ كما حُفظت', async () => {
    await setHiddenStudentEntries(h.db, admin, ['/student/exams', '/bac', '/x'])
    expect(await getHiddenStudentEntries(h.db)).toEqual(['/student/exams', '/bac'])
    const s = await makeStudent(h.db)
    await expect(setHiddenStudentEntries(h.db, s, [])).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'FORBIDDEN')
  })
})
