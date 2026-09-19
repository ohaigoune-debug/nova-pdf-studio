import { beforeEach, describe, expect, it } from 'vitest'
import { clearDraft, dequeue, listQueued, MAX_ATTEMPTS, pickDraftText, queueSubmission, readDraft, recordFailure, resetDeviceStoreForTests, writeDraft } from '@/lib/device-store'

const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'

beforeEach(() => {
  resetDeviceStoreForTests()
})

describe('تخزين المسودات على جهاز الطالب', () => {
  it('الكتابة والقراءة والمسح دون أي اتصال بالخادم', async () => {
    expect(await readDraft(A)).toBeNull()
    await writeDraft(A, 'إجابة أولى', 1000)
    expect(await readDraft(A)).toEqual({ assignmentId: A, text: 'إجابة أولى', updatedAt: 1000 })
    await writeDraft(A, 'إجابة مُحدَّثة', 2000)
    expect(await readDraft(A)).toMatchObject({ text: 'إجابة مُحدَّثة', updatedAt: 2000 })
    await clearDraft(A)
    expect(await readDraft(A)).toBeNull()
  })

  it('مسودات الواجبات مستقلة عن بعضها', async () => {
    await writeDraft(A, 'ألف', 1)
    await writeDraft(B, 'باء', 2)
    await clearDraft(A)
    expect(await readDraft(A)).toBeNull()
    expect(await readDraft(B)).toMatchObject({ text: 'باء' })
  })

  it('الأحدث يفوز: مسودة الجهاز أمام نص الخادم', () => {
    const local = { assignmentId: A, text: 'نص الجهاز', updatedAt: 500 }
    expect(pickDraftText('', null)).toBe('')
    expect(pickDraftText('نص الخادم', null)).toBe('نص الخادم')
    expect(pickDraftText('', local)).toBe('نص الجهاز')
    expect(pickDraftText('نص الخادم', { ...local, text: '   ' })).toBe('نص الخادم')
    expect(pickDraftText('نص الخادم', local, 100)).toBe('نص الجهاز')
    expect(pickDraftText('نص الخادم', local, 900)).toBe('نص الخادم')
  })
})

describe('طابور الإرسال المؤجَّل', () => {
  it('يرتّب حسب وقت الوضع في الطابور ويُفرَّغ بالإرسال', async () => {
    await queueSubmission(B, 'واجب ب', 'إجابة ب', 200)
    await queueSubmission(A, 'واجب أ', 'إجابة أ', 100)
    expect((await listQueued()).map((e) => e.assignmentId)).toEqual([A, B])
    await dequeue(A)
    const rest = await listQueued()
    expect(rest).toHaveLength(1)
    expect(rest[0]).toMatchObject({ assignmentId: B, title: 'واجب ب', text: 'إجابة ب', attempts: 0 })
  })

  it('إعادة الوضع في الطابور تستبدل الإجابة ولا تكرّرها', async () => {
    await queueSubmission(A, 'واجب أ', 'أولى', 100)
    await queueSubmission(A, 'واجب أ', 'نهائية', 300)
    const q = await listQueued()
    expect(q).toHaveLength(1)
    expect(q[0]).toMatchObject({ text: 'نهائية', queuedAt: 300 })
  })

  it('المحاولات الفاشلة تُحصى ويُسقط العنصر بعد استنفادها', async () => {
    expect(await recordFailure(A)).toEqual({ dropped: false })
    await queueSubmission(A, 'واجب أ', 'إجابة', 100)
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      expect(await recordFailure(A)).toEqual({ dropped: false })
      expect((await listQueued())[0]).toMatchObject({ attempts: i })
    }
    expect(await recordFailure(A)).toEqual({ dropped: true })
    expect(await listQueued()).toHaveLength(0)
  })
})
