import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { playQuestions } from '@/server/db/schema'
import { importQuestions, linkedCopyKey, syncCatalog, type PlayCatalog } from '@/server/play/importer'
import type { PlayContentQuestion } from '@/server/play/question-types'
import { listLessonsFor } from '@/server/services/play.service'
import { setupDb } from './helpers'

// الدرس نفسه (U3/L4) في منهاجين: الشعب العلمية، وآداب/لغات — كما في 3AS/AR
const catalog: PlayCatalog = {
  version: 1,
  grades: [
    {
      grade: '3AS',
      subjects: [
        { subject: 'AR', streams: ['SCI', 'MATH', 'TM', 'GE'], units: [{ code: 'U3', name: 'البناء اللغوي', lessons: [{ code: 'L4', name: 'الصور البيانية' }] }] },
        { subject: 'AR', streams: ['LIT', 'LANG'], units: [{ code: 'U3', name: 'البناء اللغوي', lessons: [{ code: 'L4', name: 'الصور البيانية' }] }] }
      ]
    }
  ]
} as PlayCatalog

const q = (n: number, streams?: string[]): PlayContentQuestion => ({
  key: `3AS-AR-U3-L4-${String(n).padStart(4, '0')}`,
  type: 'MCQ',
  grade: '3AS',
  ...(streams ? { streams } : {}),
  subject: 'AR',
  unit: 'U3',
  lesson: 'L4',
  difficulty: 'EASY',
  question: `ما نوع الصورة البيانية في «ابتسم الصباح»؟ (${n})`,
  options: ['تشبيه بليغ', 'استعارة مكنية', 'كناية', 'مجاز مرسل'],
  correct: 1,
  explanation: 'شُبّه الصباح بإنسان يبتسم وحُذف المشبه به وأبقيت لازمة من لوازمه.'
})

let h: DatabaseHandle
beforeAll(async () => {
  h = await setupDb()
  await syncCatalog(h.db, catalog)
})
afterAll(async () => h.close())

const count = async (stream: string) => (await listLessonsFor(h.db, '3AS', stream, 'AR'))[0]!.lessons[0]!.questions

describe('ربط الأسئلة بنسخ الدرس في مناهج الشعب', () => {
  it('السؤال العام يصل إلى تلاميذ كل الشعب، والموجّه يبقى في شعبه', async () => {
    const r = await importQuestions(h.db, [q(1), q(2), q(3, ['LIT', 'LANG']), q(4, ['SCI', 'MATH', 'TM', 'GE'])])
    expect(r).toMatchObject({ total: 4, inserted: 4, updated: 0, linkedCopies: 2, skippedInvalid: 0, skippedNoLesson: 0 })
    expect(await count('SCI')).toBe(3)
    expect(await count('LIT')).toBe(3)
    expect(await count('LANG')).toBe(3)
    const copy = await h.db.select().from(playQuestions).where(eq(playQuestions.key, linkedCopyKey('3AS-AR-U3-L4-0001', ['LIT', 'LANG'])))
    expect(copy).toHaveLength(1)
  })

  it('إعادة الاستيراد لا تكرّر النسخ وتحدّثها مع الأصل', async () => {
    const changed = { ...q(1), explanation: 'شُبّه الصباح بإنسان يبتسم، فحُذف المشبه به ورُمز إليه بالابتسام: استعارة مكنية.' }
    const r = await importQuestions(h.db, [changed, q(2), q(3, ['LIT', 'LANG']), q(4, ['SCI', 'MATH', 'TM', 'GE'])])
    expect(r).toMatchObject({ inserted: 0, updated: 4, linkedCopies: 2 })
    const rows = await h.db.select({ key: playQuestions.key, explanation: playQuestions.explanation }).from(playQuestions)
    expect(rows).toHaveLength(6)
    expect(rows.filter((x) => x.key.startsWith('3AS-AR-U3-L4-0001')).every((x) => x.explanation === changed.explanation)).toBe(true)
  })
})
