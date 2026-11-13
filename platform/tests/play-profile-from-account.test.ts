import { readFileSync } from 'node:fs'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { gradeStreams, levels, playStudentStats, streams } from '@/server/db/schema'
import { PLAY_GRADES } from '@/server/play/constants'
import { playProfileFromAccount } from '@/server/play/profile-from-account'
import { registerStudent } from '@/server/services/auth.service'
import { getPlayProfile, suggestedPlayGrade } from '@/server/services/play.service'
import { streamFitsLevel } from '@/server/services/reference.service'
import { actorOf, setupDb } from './helpers'

/** البند ب3: PLAY يأخذ السنة والشعبة من الحساب فلا يسأل التلميذ ثانية */
describe('playProfileFromAccount', () => {
  const from = (levelCode: string | null, streamCode: string | null = null, parentStreamCode: string | null = null) => playProfileFromAccount({ levelCode, streamCode, parentStreamCode })

  it('كل سنة مفعّلة في PLAY وكل شعبة من شعبها: يدخل التلميذ موادّه مباشرة', () => {
    const active = PLAY_GRADES.filter((g) => g.isActive)
    expect(active.map((g) => g.code)).toEqual(['4AM', '1AS', '2AS', '3AS'])
    for (const g of active) {
      if (g.streams.length === 0) expect(from(g.code)).toEqual({ kind: 'full', gradeCode: g.code, streamCode: null })
      for (const s of g.streams) expect(from(g.code, s)).toEqual({ kind: 'full', gradeCode: g.code, streamCode: s })
    }
  })

  it('خيارات تقني رياضي تُقرأ كشعبتها الأم', () => {
    for (const opt of ['TM_CIVIL', 'TM_MECA', 'TM_ELEC', 'TM_PROC']) {
      expect(from('3AS', opt, 'TM')).toEqual({ kind: 'full', gradeCode: '3AS', streamCode: 'TM' })
      expect(from('2AS', opt, 'TM')).toEqual({ kind: 'full', gradeCode: '2AS', streamCode: 'TM' })
    }
  })

  it('السنة الأولى ثانوي بشعبة السنة الثانية: جذعها المشترك', () => {
    for (const s of ['SCI', 'MATH', 'TM', 'GE']) expect(from('1AS', s)).toEqual({ kind: 'full', gradeCode: '1AS', streamCode: 'TC_SCI' })
    for (const s of ['LIT', 'LANG']) expect(from('1AS', s)).toEqual({ kind: 'full', gradeCode: '1AS', streamCode: 'TC_LIT' })
    expect(from('1AS', 'TM_ELEC', 'TM')).toEqual({ kind: 'full', gradeCode: '1AS', streamCode: 'TC_SCI' })
  })

  it('جذع مشترك في السنة الثانية أو الثالثة يحتمل أكثر من شعبة: السنة وحدها', () => {
    expect(from('2AS', 'TC_SCI')).toEqual({ kind: 'grade-only', gradeCode: '2AS' })
    expect(from('3AS', 'TC_LIT')).toEqual({ kind: 'grade-only', gradeCode: '3AS' })
    expect(from('3AS', null)).toEqual({ kind: 'grade-only', gradeCode: '3AS' })
  })

  it('لا مستوى، أو مستوى ليس في PLAY بعد: لا استنتاج', () => {
    expect(from(null)).toEqual({ kind: 'none' })
    expect(from('2AM')).toEqual({ kind: 'none' })
    expect(from('XX', 'SCI')).toEqual({ kind: 'none' })
  })
})

describe('getPlayProfile من حساب حقيقي', () => {
  let h: DatabaseHandle
  const ids: Record<string, string> = {}
  let n = 0

  async function student(levelCode: string, streamCode: string | null) {
    n += 1
    const r = await registerStudent(h.db, { email: `play-acc-${n}@test.dz`, password: 'Student@12345', fullName: `تلميذ ${n}`, levelId: ids[levelCode], streamId: streamCode ? ids[streamCode] : null })
    return actorOf(h.db, r.userId)
  }

  beforeAll(async () => {
    h = await setupDb()
    // setupDb يزرع 3AS وSCI؛ نضيف ما يلزم الاختبار
    await h.db.insert(levels).values([
      { code: '4AM', nameAr: 'السنة الرابعة متوسط', sortOrder: 9 },
      { code: '1AS', nameAr: 'السنة الأولى ثانوي', sortOrder: 10 },
      { code: '2AS', nameAr: 'السنة الثانية ثانوي', sortOrder: 11 }
    ])
    await h.db.insert(streams).values([
      { code: 'TC_SCI', nameAr: 'جذع مشترك علوم وتكنولوجيا', sortOrder: 1 },
      { code: 'TM', nameAr: 'تقني رياضي', sortOrder: 5 }
    ])
    for (const l of await h.db.select().from(levels)) ids[l.code] = l.id
    for (const s of await h.db.select().from(streams)) ids[s.code] = s.id
    const [civil] = await h.db.insert(streams).values({ code: 'TM_CIVIL', nameAr: 'تقني رياضي — هندسة مدنية', parentId: ids.TM, sortOrder: 9 }).returning()
    ids.TM_CIVIL = civil!.id
    await h.db.insert(gradeStreams).values([{ levelId: ids['1AS']!, streamId: ids.TC_SCI! }])
  })
  afterAll(async () => {
    await h?.close()
  })

  it('3 ثانوي هندسة مدنية: PLAY على «تقني رياضي» ويُحفظ', async () => {
    const actor = await student('3AS', 'TM_CIVIL')
    const p = await getPlayProfile(h.db, actor)
    expect([p.gradeCode, p.streamCode]).toEqual(['3AS', 'TM'])
    const [saved] = await h.db.select().from(playStudentStats).where(eq(playStudentStats.studentId, actor.studentId!))
    expect([saved?.gradeCode, saved?.streamCode]).toEqual(['3AS', 'TM'])
  })

  it('1 ثانوي علوم تجريبية: جذع مشترك علوم وتكنولوجيا', async () => {
    const p = await getPlayProfile(h.db, await student('1AS', 'SCI'))
    expect([p.gradeCode, p.streamCode]).toEqual(['1AS', 'TC_SCI'])
  })

  it('4 متوسط بلا شعبة: مباشرة', async () => {
    const p = await getPlayProfile(h.db, await student('4AM', null))
    expect([p.gradeCode, p.streamCode]).toEqual(['4AM', null])
  })

  it('2 ثانوي جذع مشترك: شاشة الإعداد، والسنة مختارة سلفًا', async () => {
    const actor = await student('2AS', 'TC_SCI')
    const p = await getPlayProfile(h.db, actor)
    expect(p.gradeCode).toBeNull()
    expect(await suggestedPlayGrade(h.db, actor)).toBe('2AS')
  })

  it('شعب المستوى: 1 ثانوي يقبل جذعه فقط، ومستوى بلا شعب مسجّلة يقبل الكل', async () => {
    expect(await streamFitsLevel(h.db, ids['1AS']!, ids.TC_SCI!)).toBe(true)
    expect(await streamFitsLevel(h.db, ids['1AS']!, ids.SCI!)).toBe(false)
    expect(await streamFitsLevel(h.db, ids['3AS']!, ids.SCI!)).toBe(true)
  })
})

describe('الواجهة', () => {
  const read = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8')

  it('نموذج التسجيل يعرض شعب السنة المختارة فقط، والخادم يرفض غيرها', () => {
    expect(read('app/(public)/register/register-form.tsx')).toContain('levelStreams.map(')
    expect(read('app/(public)/register/page.tsx')).toContain('streamIds: levelStreams.get(l.id)')
    expect(read('server/actions/auth.actions.ts')).toContain('streamFitsLevel(db, d.levelId, d.streamId)')
  })

  it('شاشة إعداد PLAY تأخذ السنة من الحساب', () => {
    expect(read('app/student/play/setup/page.tsx')).toContain('suggestedPlayGrade(db, actor)')
  })
})
