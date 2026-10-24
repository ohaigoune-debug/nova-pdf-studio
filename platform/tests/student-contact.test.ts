import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { students } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { updateGuardianContact } from '@/server/services/student-contact.service'
import { makeAdmin, makeStudent, setupDb } from './helpers'

let h: DatabaseHandle
let student: Actor
let sibling: Actor
let admin: Actor
beforeAll(async () => { h = await setupDb(); student = await makeStudent(h.db); sibling = await makeStudent(h.db); admin = await makeAdmin(h.db) })
afterAll(async () => { await h.close() })
it('normalizes a contact and permits siblings to share it without modifying another student', async () => {
  await updateGuardianContact(h.db, student, { guardianPhone: '+213 661 234 567' })
  const [other] = await h.db.select().from(students).where(eq(students.id, sibling.studentId!))
  expect(other?.guardianPhone).toBeNull()
  await updateGuardianContact(h.db, sibling, { guardianPhone: '0661234567' })
  const rows = await h.db.select().from(students)
  expect(rows.filter((s) => s.guardianPhone === '0661234567')).toHaveLength(2)
})
it('rejects invalid contacts, other roles, and mismatched ownership', async () => {
  await expect(updateGuardianContact(h.db, student, { guardianPhone: '123' })).rejects.toMatchObject({ code: 'VALIDATION' })
  await expect(updateGuardianContact(h.db, admin, { guardianPhone: '0661234567' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await expect(updateGuardianContact(h.db, { ...student, studentId: sibling.studentId }, { guardianPhone: '0771234567' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
})
