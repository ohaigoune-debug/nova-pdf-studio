import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { bankQuestions, exams, levels, listingPurchases, notifications, products, subjects } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import type { Actor } from '@/server/lib/actor'
import { addItemFromBank, createExam, getExam, listExams } from '@/server/services/exams.service'
import { uploadFile } from '@/server/services/files.service'
import { balancesAdmin, canReadExam, createListing, createPayout, getExamForReader, listListingsAdmin, marketStats, myListings, reviewListing, submitListing, teacherEarnings, updateListing } from '@/server/services/marketplace.service'
import { createBankQuestion, listBankQuestions } from '@/server/services/question-bank.service'
import { getOrder, getProduct, listProducts, placeOrder, setOrderStatus } from '@/server/services/store.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

let h: DatabaseHandle
let admin: Actor
let seller: Actor
let buyer: Actor
let student: Actor
let arabic: string
let l3: string
let examId: string
let q1: string
let q2: string
let thirdParty: string
let fileId: string

beforeAll(async () => {
  h = await setupDb()
  await seedCurriculum(h.db)
  process.env.UPLOADS_DIR = await mkdtemp(path.join(tmpdir(), 'market-uploads-'))
  process.env.MARKETPLACE_TEACHER_SHARE_PCT = '70'
  admin = await makeAdmin(h.db)
  seller = await makeTeacher(h.db, admin, 'الأستاذ البائع')
  buyer = await makeTeacher(h.db, admin, 'الأستاذ المشتري')
  student = await makeStudent(h.db)
  arabic = (await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'ARABIC')))[0]!.id
  l3 = (await h.db.select({ id: levels.id }).from(levels).where(eq(levels.code, '3AS')))[0]!.id
  q1 = (await createBankQuestion(h.db, seller, { kind: 'EXERCISE', type: 'OPEN', title: 'البناء الفكري', body: 'اقرأ النصّ ثم أجب.', points: 8, difficulty: 2, subjectId: arabic, levelId: l3, solution: 'الحلّ' })).id
  await createBankQuestion(h.db, seller, { type: 'OPEN', body: 'سؤال فرعي', points: 4, parentId: q1, sortOrder: 0 })
  q2 = (await createBankQuestion(h.db, seller, { type: 'MCQ', body: 'نوع الصورة؟', options: [{ label: 'استعارة', isCorrect: true }, { label: 'كناية', isCorrect: false }], points: 2, subjectId: arabic, levelId: l3 })).id
  thirdParty = (await createBankQuestion(h.db, seller, { type: 'OPEN', body: 'من بكالوريا رسمية', points: 4, rightsStatus: 'THIRD_PARTY', subjectId: arabic, levelId: l3 })).id
  const ex = await createExam(h.db, seller, { title: 'اختبار الفصل الأول — عربية', subjectId: arabic, levelId: l3, schoolTerm: 1 })
  examId = ex.id
  await addItemFromBank(h.db, seller, examId, q1)
  await addItemFromBank(h.db, seller, examId, q2)
  fileId = (await uploadFile(h.db, seller, { originalName: 'summary.pdf', mimeType: 'application/pdf', bytes: Buffer.from('%PDF-1.4 summary') })).id
})

afterAll(async () => {
  delete process.env.MARKETPLACE_TEACHER_SHARE_PCT
  await h.close()
})

describe('سوق الأساتذة — المرحلة 11', () => {
  it('إنشاء العروض: مصادر صحيحة فقط، حقوق مؤكَّدة قبل الإرسال، أسئلة الطرف الثالث لا تُباع', async () => {
    await expect(createListing(h.db, seller, { kind: 'EXAM', title: 'x', priceDzd: 100 })).rejects.toMatchObject({ code: 'LISTING_SOURCE_INVALID' })
    await expect(createListing(h.db, seller, { kind: 'EXAM', title: 'x', priceDzd: 100, examId: (await createExam(h.db, seller, { title: 'فارغ' })).id })).rejects.toMatchObject({ code: 'LISTING_SOURCE_INVALID' })
    await expect(createListing(h.db, buyer, { kind: 'EXAM', title: 'x', priceDzd: 100, examId })).rejects.toMatchObject({ code: 'EXAM_NOT_FOUND' })
    await expect(createListing(h.db, seller, { kind: 'QUESTION_BANK', title: 'x', priceDzd: 100, questionIds: [q1, thirdParty] })).rejects.toMatchObject({ code: 'LISTING_RIGHTS_REQUIRED' })
    await expect(createListing(h.db, seller, { kind: 'SUMMARY', title: 'x', priceDzd: 100, fileId: '00000000-0000-4000-8000-000000000000' })).rejects.toMatchObject({ code: 'LISTING_SOURCE_INVALID' })
    await expect(createListing(h.db, student, { kind: 'SUMMARY', title: 'x', priceDzd: 0, fileId })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const l = await createListing(h.db, seller, { kind: 'EXAM', title: 'اختبار جاهز — الفصل الأول', description: 'ورقة كاملة مع التصحيح', priceDzd: 500, subjectId: arabic, levelId: l3, examId })
    expect(l).toMatchObject({ status: 'DRAFT', teachersOnly: true, teacherSharePct: 70, rightsConfirmed: false })
    await expect(submitListing(h.db, seller, l.id)).rejects.toMatchObject({ code: 'LISTING_RIGHTS_REQUIRED' })
    await updateListing(h.db, seller, l.id, { rightsConfirmed: true, priceDzd: 400 })
    const s = await submitListing(h.db, seller, l.id)
    expect(s.status).toBe('PENDING_REVIEW')
    await expect(updateListing(h.db, seller, l.id, { title: 'y' })).rejects.toMatchObject({ code: 'LISTING_INVALID_STATE' })
    await expect(submitListing(h.db, seller, l.id)).rejects.toMatchObject({ code: 'LISTING_INVALID_STATE' })
    const adminNotes = await h.db.select().from(notifications).where(eq(notifications.userId, admin.userId))
    expect(adminNotes.some((n) => n.title.includes('بانتظار المراجعة'))).toBe(true)
    expect((await myListings(h.db, seller)).map((x) => x.l.id)).toEqual([l.id])
    expect(await myListings(h.db, buyer)).toEqual([])
  })

  it('المراجعة: الرفض بملاحظة، والقبول ينشر منتجاً في المتجر باسم الأستاذ', async () => {
    const [l] = await myListings(h.db, seller)
    await expect(reviewListing(h.db, seller, l!.l.id, { approve: true })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const rejected = await reviewListing(h.db, admin, l!.l.id, { approve: false, note: 'أضف التصحيح' })
    expect(rejected).toMatchObject({ status: 'REJECTED', reviewNote: 'أضف التصحيح', productId: null })
    await submitListing(h.db, seller, l!.l.id)
    const published = await reviewListing(h.db, admin, l!.l.id, { approve: true })
    expect(published.status).toBe('PUBLISHED')
    expect(published.productId).not.toBeNull()
    const [p] = await h.db.select().from(products).where(eq(products.id, published.productId!))
    expect(p).toMatchObject({ title: 'اختبار جاهز — الفصل الأول', priceDzd: 400, status: 'PUBLISHED', workspaceId: seller.workspaceId, type: 'PDF' })
    const view = await getProduct(h.db, p!.slug)
    expect(view.sellerName).toBeTruthy()
    expect(view.listing).toMatchObject({ kind: 'EXAM', teachersOnly: true })
    expect((await listProducts(h.db)).some((x) => x.id === p!.id)).toBe(true)
    // تعديل السعر بعد النشر يتبعه المنتج
    await updateListing(h.db, seller, l!.l.id, { priceDzd: 600 })
    expect((await h.db.select().from(products).where(eq(products.id, p!.id)))[0]!.priceDzd).toBe(600)
    expect((await listListingsAdmin(h.db, admin, 'PUBLISHED')).map((x) => x.l.id)).toEqual([l!.l.id])
    const sellerNotes = await h.db.select().from(notifications).where(eq(notifications.userId, seller.userId))
    expect(sellerNotes.map((n) => n.title)).toEqual(expect.arrayContaining([expect.stringContaining('لم يُقبل'), expect.stringContaining('نُشر عرضك')]))
  })

  it('الشراء: للأساتذة فقط، وبعد التأكيد نسخة من الامتحان في ورشة المشتري ونصيب البائع وحقّ الطباعة', async () => {
    const [l] = await myListings(h.db, seller)
    const productId = l!.l.productId!
    await expect(placeOrder(h.db, student, { items: [{ productId, qty: 1 }], customerName: 'تلميذ', phone: '0555555555' })).rejects.toMatchObject({ code: 'LISTING_TEACHERS_ONLY' })
    const o = await placeOrder(h.db, buyer, { items: [{ productId, qty: 1 }], customerName: 'المشتري', phone: '0666666666' })
    expect(o).toMatchObject({ status: 'PENDING', paymentMethod: 'TRANSFER', totalDzd: 600 })
    expect(await canReadExam(h.db, buyer, examId)).toBe(false)
    expect((await listExams(h.db, buyer)).length).toBe(0)
    await setOrderStatus(h.db, admin, o.id, 'CONFIRMED')
    const [purchase] = await h.db.select().from(listingPurchases).where(eq(listingPurchases.buyerUserId, buyer.userId))
    expect(purchase).toMatchObject({ listingId: l!.l.id, orderId: o.id, priceDzd: 600, teacherShareDzd: 420, platformShareDzd: 180 })
    expect(typeof purchase!.delivered.examId).toBe('string')
    const copied = await getExam(h.db, buyer, String(purchase!.delivered.examId))
    expect(copied).toMatchObject({ title: 'اختبار الفصل الأول — عربية', status: 'DRAFT', sourceExamId: examId })
    expect(copied.header.teacherName).toBe(buyer.fullName)
    expect(copied.items).toHaveLength(2)
    expect(copied.items.every((i) => i.bankQuestionId === null)).toBe(true)
    expect(copied.items[0]!.snapshot.children).toHaveLength(1)
    // الأصل لم يُمسّ
    expect((await h.db.select().from(exams).where(eq(exams.id, examId)))[0]!.workspaceId).toBe(seller.workspaceId)
    expect(await canReadExam(h.db, buyer, examId)).toBe(true)
    const reader = await getExamForReader(h.db, buyer, examId)
    expect(reader.readOnly).toBe(true)
    expect(reader.exam.id).toBe(examId)
    expect((await getExamForReader(h.db, seller, examId)).readOnly).toBe(false)
    await expect(getExamForReader(h.db, student, examId)).rejects.toMatchObject({ code: 'EXAM_NOT_FOUND' })
    // التسليم مرّة واحدة حتى لو تغيّرت الحالة مجدّداً
    await setOrderStatus(h.db, admin, o.id, 'DELIVERED')
    expect((await h.db.select().from(listingPurchases).where(eq(listingPurchases.buyerUserId, buyer.userId))).length).toBe(1)
    expect((await listExams(h.db, buyer)).length).toBe(1)
    const earnings = await teacherEarnings(h.db, seller)
    expect(earnings).toMatchObject({ sales: 1, earnedDzd: 420, grossDzd: 600, paidDzd: 0, balanceDzd: 420 })
    expect((await getOrder(h.db, buyer, o.id)).canDownload).toBe(true)
  })

  it('حزمة أسئلة مجانية تُنسخ فوراً إلى بنك المشتري بحقوق مرخَّصة، والدفعات تُسوّي الرصيد', async () => {
    const l = await createListing(h.db, seller, { kind: 'QUESTION_BANK', title: 'حزمة البلاغة', priceDzd: 0, questionIds: [q1, q2], rightsConfirmed: true, subjectId: arabic, levelId: l3 })
    await submitListing(h.db, seller, l.id)
    const pub = await reviewListing(h.db, admin, l.id, { approve: true })
    const o = await placeOrder(h.db, buyer, { items: [{ productId: pub.productId!, qty: 1 }], customerName: 'المشتري', phone: '0666666666' })
    expect(o.status).toBe('DELIVERED')
    const bank = await listBankQuestions(h.db, buyer, { scope: 'mine' })
    expect(bank.items).toHaveLength(2)
    const copiedParent = (await h.db.select().from(bankQuestions).where(eq(bankQuestions.workspaceId, buyer.workspaceId!)))
    expect(copiedParent.length).toBe(3) // تمرين + فرعي + MCQ
    expect(copiedParent.every((q) => q.rightsStatus === 'LICENSED' && q.visibility === 'PRIVATE' && q.usageCount === 0 && q.sourceLabel?.startsWith('من السوق'))).toBe(true)
    // البائع لا يتأثر
    expect((await listBankQuestions(h.db, seller, { scope: 'mine' })).items.length).toBe(3)
    const [p] = await h.db.select().from(listingPurchases).where(eq(listingPurchases.listingId, l.id))
    expect(p).toMatchObject({ priceDzd: 0, teacherShareDzd: 0, delivered: { copied: 2 } })
    // الدفعات
    const balances = await balancesAdmin(h.db, admin)
    expect(balances[0]).toMatchObject({ workspaceId: seller.workspaceId, sales: 2, earned: 420, balanceDzd: 420 })
    await expect(createPayout(h.db, admin, { workspaceId: seller.workspaceId!, amountDzd: 0 })).rejects.toMatchObject({ code: 'VALIDATION' })
    await createPayout(h.db, admin, { workspaceId: seller.workspaceId!, amountDzd: 400, paid: true, note: 'CCP' })
    const e = await teacherEarnings(h.db, seller)
    expect(e).toMatchObject({ paidDzd: 400, balanceDzd: 20 })
    expect((await balancesAdmin(h.db, admin))[0]!.balanceDzd).toBe(20)
    const stats = await marketStats(h.db, admin)
    expect(stats).toMatchObject({ published: 2, sales: 2, grossDzd: 600, platformDzd: 180, teachersDzd: 420 })
  })
})
