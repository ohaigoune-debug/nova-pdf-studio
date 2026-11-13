/**
 * البند ب5 (12 نوفمبر 2026): كل إعداد تجاري من لوحة الإدارة دون برمجة.
 * رسم التوصيل الاحتياطي، ونصيب الأستاذ في السوق، ومدة تجربة PLAY: من الإعدادات، بقيمها القديمة ما لم تُحفظ.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { appSettings, playAccessTrials } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { daysAr, hoursAr, spanAr } from '@/lib/arabic-count'
import { commercialDefaults, commercialSettings, commercialSettingsHistory, setCommercialSettings } from '@/server/services/commercial-settings.service'
import { teacherSharePct } from '@/server/services/marketplace.service'
import { beginPlayAccess, getPlayAccess } from '@/server/services/play-access.service'
import { shippingFeeDzd, shippingFeeFor } from '@/server/services/store.service'
import { makeAdmin, makeStudent, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
const H = 3_600_000
const scope = { gradeCode: '3AS', streamCode: 'SCI', subjectCode: 'AR' }

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
})
afterEach(async () => {
  vi.unstubAllEnvs()
  await h.db.delete(appSettings).where(eq(appSettings.key, 'commercial.settings'))
})
afterAll(async () => {
  await h.close()
})

describe('القيم قبل أي حفظ: كما كان الخادم يعمل', () => {
  it('من البيئة إن ضُبطت، وإلا 0 دج و70% و72 ساعة', async () => {
    vi.stubEnv('STORE_SHIPPING_DZD', '')
    vi.stubEnv('MARKETPLACE_TEACHER_SHARE_PCT', '')
    expect(await commercialSettings(h.db)).toEqual({ shippingFallbackDzd: 0, marketplaceTeacherSharePct: 70, playTrialHours: 72 })
    vi.stubEnv('STORE_SHIPPING_DZD', '450')
    vi.stubEnv('MARKETPLACE_TEACHER_SHARE_PCT', '65')
    expect(await commercialSettings(h.db)).toEqual({ shippingFallbackDzd: 450, marketplaceTeacherSharePct: 65, playTrialHours: 72 })
  })

  it('قيمة بيئة غير صالحة تُهمَل', () => {
    expect(commercialDefaults({ STORE_SHIPPING_DZD: 'abc', MARKETPLACE_TEACHER_SHARE_PCT: '150' })).toEqual({ shippingFallbackDzd: 0, marketplaceTeacherSharePct: 70, playTrialHours: 72 })
    expect(commercialDefaults({ STORE_SHIPPING_DZD: '-5' }).shippingFallbackDzd).toBe(0)
  })
})

describe('الحفظ من اللوحة', () => {
  it('يغلب البيئة، ويحفظ ما أُرسل وحده، ويُسجَّل من غيّر ومتى', async () => {
    vi.stubEnv('STORE_SHIPPING_DZD', '450')
    const next = await setCommercialSettings(h.db, admin, { shippingFallbackDzd: 600 })
    expect(next).toEqual({ shippingFallbackDzd: 600, marketplaceTeacherSharePct: 70, playTrialHours: 72 })
    expect(await commercialSettings(h.db)).toEqual(next)
    const [last] = await commercialSettingsHistory(h.db, admin, 1)
    expect(last?.changes).toEqual([{ key: 'shippingFallbackDzd', label: 'رسم التوصيل الاحتياطي (دج)', from: 450, to: 600 }])
    expect(last?.at).toBeInstanceOf(Date)
  })

  it('حدود دنيا وعليا: لا سعر خيالي', async () => {
    for (const bad of [{ shippingFallbackDzd: 5001 }, { shippingFallbackDzd: -1 }, { marketplaceTeacherSharePct: 101 }, { playTrialHours: 0 }, { playTrialHours: 721 }, { playTrialHours: 1.5 }, { shippingFallbackDzd: '500' }]) {
      await expect(setCommercialSettings(h.db, admin, bad)).rejects.toMatchObject({ code: 'VALIDATION' })
    }
    expect((await commercialSettings(h.db)).playTrialHours).toBe(72)
  })

  it('للمشرف العام وحده', async () => {
    const s = await makeStudent(h.db)
    await expect(setCommercialSettings(h.db, s, { shippingFallbackDzd: 1 })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(commercialSettingsHistory(h.db, s)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('أثر الإعداد في الطلب التالي دون إعادة تشغيل', () => {
  it('رسم التوصيل الاحتياطي', async () => {
    await setCommercialSettings(h.db, admin, { shippingFallbackDzd: 550 })
    expect(await shippingFeeDzd(h.db)).toBe(550)
    expect(await shippingFeeFor(h.db, null, 'HOME')).toBe(550)
  })

  it('نصيب الأستاذ في السوق', async () => {
    await setCommercialSettings(h.db, admin, { marketplaceTeacherSharePct: 80 })
    expect(await teacherSharePct(h.db)).toBe(80)
  })

  it('مدة تجربة PLAY: التجربة الجديدة بالمدة الجديدة، والقائمة كما هي', async () => {
    const T0 = new Date('2026-11-20T08:00:00.000Z')
    const old = await makeStudent(h.db)
    await beginPlayAccess(h.db, old, scope, T0)
    await setCommercialSettings(h.db, admin, { playTrialHours: 24 })
    const fresh = await makeStudent(h.db)
    const before = await getPlayAccess(h.db, fresh, scope, T0)
    expect(before.state).toEqual({ kind: 'trial_available', trialHours: 24 })
    await beginPlayAccess(h.db, fresh, scope, T0)
    const [t] = await h.db.select().from(playAccessTrials).where(eq(playAccessTrials.studentId, fresh.studentId!))
    expect(t!.endsAt.getTime() - t!.startedAt.getTime()).toBe(24 * H)
    const [o] = await h.db.select().from(playAccessTrials).where(eq(playAccessTrials.studentId, old.studentId!))
    expect(o!.endsAt.getTime() - o!.startedAt.getTime()).toBe(72 * H)
  })
})

describe('نص المدة بالعربية', () => {
  it('أيام كاملة بالأيام، وإلا بالساعات', () => {
    expect(spanAr(72)).toBe('3 أيام')
    expect(spanAr(24)).toBe('يومًا واحدًا')
    expect(spanAr(48)).toBe('يومين')
    expect(spanAr(264)).toBe('11 يومًا')
    expect(spanAr(36)).toBe('36 ساعة')
    expect(hoursAr(72)).toBe('72 ساعة')
    expect(hoursAr(2)).toBe('ساعتين')
    expect(hoursAr(5)).toBe('5 ساعات')
    expect(daysAr(10)).toBe('10 أيام')
  })
})

describe('حارس: لا رقم تجاري جديد خارج الإعدادات', () => {
  const root = new URL('../src/', import.meta.url).pathname
  const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : /\.(ts|tsx)$/.test(f) ? [join(dir, f)] : []))
  const all = files(root).map((f) => ({ f: f.slice(root.length), src: readFileSync(f, 'utf8') }))

  it('لا قراءة لأسعار أو عمولات من البيئة إلا في commercial-settings.service', () => {
    const hits = all.filter(({ f, src }) => f !== 'server/services/commercial-settings.service.ts' && /process\.env\.[A-Z_]*(PRICE|FEE|DZD|SHARE|PCT|PERCENT|COMMISSION|DISCOUNT|REWARD|BONUS|CREDIT)/.test(src)).map(({ f }) => f)
    expect(hits).toEqual([])
  })

  it('ثوابت المبالغ في الكود: حدود تحقق وبوابة الدفع فقط', () => {
    const found = all.flatMap(({ f, src }) => [...src.matchAll(/export const ([A-Z_]*_DZD) = /g)].map((m) => `${f}:${m[1]}`)).sort()
    // 50 دج: أدنى مبلغ تقبله بوابة eFawtara (لا قرار تجاري)
    expect(found).toEqual(['server/services/course-purchase.service.ts:DIGITAL_MIN_DZD', 'server/services/referrals.service.ts:ONLINE_MIN_DZD'])
  })

  it('صفحة الإعدادات فيها البطاقة، وشعار التجربة يقرأ المدة', () => {
    expect(readFileSync(join(root, 'app/admin/settings/page.tsx'), 'utf8')).toContain('<CommercialSettingsForm')
    const banner = readFileSync(join(root, 'components/play/exams/access-banner.tsx'), 'utf8')
    expect(banner).toContain('spanAr(st.trialHours)')
    expect(banner).not.toMatch(/72 ساعة|3 أيام/)
  })
})
