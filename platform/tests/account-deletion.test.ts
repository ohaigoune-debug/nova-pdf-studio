import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { groupStudents, profiles, students, users } from '@/server/db/schema'
import { AppError } from '@/server/lib/errors'
import { deleteOwnAccount, deletedEmail, DELETED_NAME } from '@/server/services/account-deletion.service'
import { login, registerStudent } from '@/server/services/auth.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { createGroup } from '@/server/services/groups.service'
import { actorOf, makeAdmin, makeTeacher, setupDb, uniq } from './helpers'

describe('حذف التلميذ حسابه بنفسه', () => {
  it('يمحو الهوية ويمنع الدخول، ويُبقي البريد متاحاً لتسجيل جديد', async () => {
    const h = await setupDb()
    try {
      const email = `${uniq('s')}@test.dz`
      const reg = await registerStudent(h.db, { email, password: 'Student@12345', fullName: 'تلميذ للحذف' })
      const userId = reg.userId
      const teacher = await makeTeacher(h.db, await makeAdmin(h.db))
      const group = await createGroup(h.db, teacher, { name: 'فوج الحذف', dayOfWeek: 6, startTime: '08:00' })
      const { codes } = await generateCodes(h.db, teacher, { groupId: group.id, count: 1 })
      await redeemEnrollmentCode(h.db, await actorOf(h.db, userId), codes[0]!.code)

      await expect(deleteOwnAccount(h.db, userId, 'wrong-password')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
      await deleteOwnAccount(h.db, userId, 'Student@12345')

      const [u] = await h.db.select().from(users).where(eq(users.id, userId))
      expect(u).toMatchObject({ email: deletedEmail(userId), status: 'DISABLED' })
      const [p] = await h.db.select().from(profiles).where(eq(profiles.userId, userId))
      expect(p).toMatchObject({ fullName: DELETED_NAME, phone: null })
      const [s] = await h.db.select().from(students).where(eq(students.userId, userId))
      expect(s).toMatchObject({ wilayaId: null, schoolId: null, guardianPhone: null })
      const enrolled = await h.db.select().from(groupStudents).where(eq(groupStudents.studentId, s!.id))
      expect(enrolled).toHaveLength(1)
      expect(enrolled[0]).toMatchObject({ status: 'LEFT_GROUP' })

      await expect(login(h.db, { email, password: 'Student@12345' })).rejects.toBeInstanceOf(AppError)
      // البريد نفسه يصلح لحساب جديد
      await expect(registerStudent(h.db, { email, password: 'Student@12345', fullName: 'تلميذ جديد' })).resolves.toBeTruthy()
    } finally {
      await h.close()
    }
  })

  it('الأستاذ لا يحذف حسابه بهذا الزرّ', async () => {
    const h = await setupDb()
    try {
      const admin = await makeAdmin(h.db)
      const teacher = await makeTeacher(h.db, admin)
      await expect(deleteOwnAccount(h.db, teacher.userId, 'Teacher@12345')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    } finally {
      await h.close()
    }
  })
})
