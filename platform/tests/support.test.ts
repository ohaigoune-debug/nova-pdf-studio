import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { auditLogs, notifications } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { assignTicket, getTicket, listTicketsAdmin, myTickets, openTicket, replyTicket, setTicketStatus, supportAgents, supportStats } from '@/server/services/support.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let admin2: Actor
let teacher: Actor
let student: Actor
let other: Actor

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  admin2 = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'أستاذ الدعم')
  student = await makeStudent(h.db, 'تلميذ الدعم')
  other = await makeStudent(h.db, 'تلميذ آخر')
})

afterAll(async () => {
  await h.close()
})

describe('مركز الدعم والشكاوى', () => {
  let t1: string
  let t2: string

  it('فتح تذكرة: رقم تسلسلي، رسالة أولى، إشعار للمشرفين، وسجلّ', async () => {
    await expect(openTicket(h.db, student, { kind: 'ORDER', subject: 'ق', body: 'نص' })).rejects.toMatchObject({ code: 'VALIDATION' })
    const a = await openTicket(h.db, student, { kind: 'DELIVERY', subject: 'الكتاب لم يصل', body: 'مرّ أسبوعان على الشحن ولم يصل الطرد.' })
    const b = await openTicket(h.db, student, { kind: 'ACCESS', subject: 'الدورة غير مفعّلة', body: 'استلمت الكتاب ولم تُفعَّل الدورة.' })
    t1 = a.id
    t2 = b.id
    expect(b.number).toBeGreaterThan(a.number)
    expect(a).toMatchObject({ status: 'OPEN', isSensitive: false, kind: 'DELIVERY' })
    const adminNotes = await h.db.select().from(notifications).where(eq(notifications.userId, admin.userId))
    expect(adminNotes.some((n) => n.title.includes(`#${a.number}`))).toBe(true)
    const audits = await h.db.select().from(auditLogs).where(eq(auditLogs.action, 'support.open'))
    expect(audits.length).toBeGreaterThanOrEqual(2)
    const mine = await myTickets(h.db, student)
    expect(mine.map((t) => t.id)).toEqual([t2, t1])
    expect(mine[0]!.messages).toBe(1)
  })

  it('الردّ: الموظف يضع «بانتظار المستخدم» ويُخطر صاحبها؛ ردّ صاحبها يعيدها مفتوحة', async () => {
    await replyTicket(h.db, admin, t1, 'نتحقّق مع شركة التوصيل ونعود إليك.')
    let v = await getTicket(h.db, student, t1)
    expect(v.ticket.status).toBe('WAITING_USER')
    expect(v.messages).toHaveLength(2)
    expect(v.messages[1]).toMatchObject({ isStaff: true, isInternal: false })
    expect(v.staff).toBe(false)
    const notes = await h.db.select().from(notifications).where(eq(notifications.userId, student.userId))
    expect(notes.some((n) => n.title.includes('ردّ على تذكرتك'))).toBe(true)
    await replyTicket(h.db, student, t1, 'شكراً، أنتظر.')
    v = await getTicket(h.db, admin, t1)
    expect(v.ticket.status).toBe('OPEN')
    expect(v.messages).toHaveLength(3)
  })

  it('الملاحظة الداخلية لا يراها صاحب التذكرة ولا يكتبها', async () => {
    await expect(replyTicket(h.db, student, t1, 'ملاحظة', { internal: true })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await replyTicket(h.db, admin, t1, 'رقم الطرد عند Yalidine: 123 — تأخير في المركز.', { internal: true })
    const asOwner = await getTicket(h.db, student, t1)
    expect(asOwner.messages.some((m) => m.isInternal)).toBe(false)
    expect(asOwner.messages.some((m) => m.body.includes('Yalidine'))).toBe(false)
    const asStaff = await getTicket(h.db, admin, t1)
    expect(asStaff.messages.filter((m) => m.isInternal)).toHaveLength(1)
    // الملاحظة الداخلية لا تغيّر الحالة
    expect(asStaff.ticket.status).toBe('OPEN')
  })

  it('تغيير الحالة والإسناد', async () => {
    await expect(setTicketStatus(h.db, student, t1, 'IN_PROGRESS')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(assignTicket(h.db, student, t1, admin.userId)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(assignTicket(h.db, admin, t1, teacher.userId)).rejects.toMatchObject({ code: 'VALIDATION' })
    await assignTicket(h.db, admin, t1, admin2.userId)
    let v = await getTicket(h.db, admin, t1)
    expect(v.ticket.status).toBe('IN_PROGRESS')
    expect(v.ticket.assignedToUserId).toBe(admin2.userId)
    expect(v.ticket.assigneeName).toBe('المشرف العام')
    await setTicketStatus(h.db, admin, t1, 'RESOLVED')
    v = await getTicket(h.db, student, t1)
    expect(v.ticket.status).toBe('RESOLVED')
    expect(v.ticket.closedAt).not.toBeNull()
    // صاحب التذكرة يغلق أو يعيد الفتح فقط
    await setTicketStatus(h.db, student, t1, 'CLOSED')
    await expect(replyTicket(h.db, student, t1, 'ردّ بعد الإغلاق')).rejects.toMatchObject({ code: 'TICKET_CLOSED' })
    await setTicketStatus(h.db, student, t1, 'OPEN')
    v = await getTicket(h.db, student, t1)
    expect(v.ticket.status).toBe('OPEN')
    expect(v.ticket.closedAt).toBeNull()
    const agents = await supportAgents(h.db, admin)
    expect(agents.map((a) => a.id).sort()).toEqual([admin.userId, admin2.userId].sort())
  })

  it('العزل: تلميذ آخر لا يرى التذكرة، والأستاذ لا يرى شيئاً، والحساسة للمشرف العام فقط', async () => {
    await expect(getTicket(h.db, other, t1)).rejects.toMatchObject({ code: 'TICKET_NOT_FOUND' })
    await expect(replyTicket(h.db, other, t1, 'تطفّل')).rejects.toMatchObject({ code: 'TICKET_NOT_FOUND' })
    await expect(getTicket(h.db, teacher, t1)).rejects.toMatchObject({ code: 'TICKET_NOT_FOUND' })
    await expect(listTicketsAdmin(h.db, teacher)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(supportStats(h.db, teacher)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const s = await openTicket(h.db, other, { kind: 'TEACHER', subject: 'سلوك غير لائق', body: 'تفاصيل حساسة عن الأستاذ.' })
    expect(s.isSensitive).toBe(true)
    await expect(getTicket(h.db, teacher, s.id)).rejects.toMatchObject({ code: 'TICKET_NOT_FOUND' })
    await expect(getTicket(h.db, student, s.id)).rejects.toMatchObject({ code: 'TICKET_NOT_FOUND' })
    const v = await getTicket(h.db, admin, s.id)
    expect(v.ticket.isSensitive).toBe(true)
    expect(v.ticket.ownerName).toBe('تلميذ آخر')
    const all = await listTicketsAdmin(h.db, admin)
    expect(all.map((t) => t.id)).toContain(s.id)
    expect(all[0]!.number).toBeGreaterThan(all[all.length - 1]!.number)
    expect((await listTicketsAdmin(h.db, admin, { kind: 'TEACHER' })).map((t) => t.id)).toEqual([s.id])
    expect((await listTicketsAdmin(h.db, admin, { assignedToUserId: admin2.userId })).map((t) => t.id)).toEqual([t1])
    expect((await listTicketsAdmin(h.db, admin, { q: String(s.number) })).map((t) => t.id)).toEqual([s.id])
    const stats = await supportStats(h.db, admin)
    expect(stats.total).toBe(3)
    expect(stats.sensitive).toBe(1)
  })
})
