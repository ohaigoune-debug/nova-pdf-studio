/** منتدى لكل دورة (قرار المالك 21 نوفمبر 2026): التلميذ يرى منتديات دوراته المفعّلة وحدها */
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { courseEnrollments, courses, groups, groupStudents, teachers } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { studentCourseForums } from '@/server/services/classroom.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let student: Actor
const ids = { course: '', presence: '', expired: '' }

beforeAll(async () => {
  h = await setupDb()
  const admin = await makeAdmin(h.db)
  const teacher = await makeTeacher(h.db, admin, 'أستاذ المنتدى')
  student = await makeStudent(h.db, 'تلميذ المنتدى')
  const workspaceId = await workspaceIdOfTeacher(h.db, teacher)
  const [t] = await h.db.select({ id: teachers.id }).from(teachers).where(eq(teachers.workspaceId, workspaceId))
  const mk = async (name: string) => (await h.db.insert(groups).values({ workspaceId, teacherId: t!.id, name }).returning())[0]!.id
  ids.course = await mk('ب: فوج الدورة')
  ids.presence = await mk('أ: فوج حضوري')
  ids.expired = await mk('ج: دورة منتهية')
  for (const g of [ids.course, ids.presence, ids.expired]) await h.db.insert(groupStudents).values({ workspaceId, groupId: g, studentId: student.studentId! })
  const [c1] = await h.db.insert(courses).values({ slug: 'forum-c1', title: 'دورة', workspaceId, groupId: ids.course, season: '2026/2027', status: 'PUBLISHED', priceDzd: 0 }).returning()
  const [c2] = await h.db.insert(courses).values({ slug: 'forum-c2', title: 'دورة منتهية', workspaceId, groupId: ids.expired, season: '2025/2026', status: 'PUBLISHED', priceDzd: 0 }).returning()
  await h.db.insert(courseEnrollments).values({ courseId: c1!.id, studentId: student.studentId!, status: 'ACTIVE' })
  await h.db.insert(courseEnrollments).values({ courseId: c2!.id, studentId: student.studentId!, status: 'EXPIRED' })
})

afterAll(async () => {
  await h.close()
})

describe('منتديات التلميذ', () => {
  it('أفواج دوراته المفعّلة فقط: لا الفوج الحضوري ولا الدورة المنتهية', async () => {
    expect((await studentCourseForums(h.db, student)).map((g) => g.id)).toEqual([ids.course])
  })

  it('تلميذ بلا دورة: لا منتدى', async () => {
    const other = await makeStudent(h.db, 'تلميذ بلا دورة')
    expect(await studentCourseForums(h.db, other)).toEqual([])
  })
})
