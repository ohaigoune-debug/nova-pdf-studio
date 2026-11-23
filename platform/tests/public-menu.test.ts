import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import type { Actor } from '@/server/lib/actor'
import { DEFAULT_HIDDEN_PUBLIC, HIDEABLE_PUBLIC_ENTRIES, HOME_LATEST_KEY, LEVEL_PICKER_KEY, cleanHiddenPublic, resolveHiddenPublic } from '@/lib/public-menu'
import { FOOTER_EXTRA, MAIN_SECTIONS } from '@/lib/sections'
import { getHiddenPublicEntries, setHiddenPublicEntries } from '@/server/services/public-menu.service'
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

describe('تبويبات الواجهة العامّة', () => {
  it('كلّ أقسام الترويسة واختيار المستوى قابلة للإخفاء', () => {
    const keys = HIDEABLE_PUBLIC_ENTRIES.map((e) => e.key)
    expect(keys).toContain(LEVEL_PICKER_KEY)
    for (const s of [...MAIN_SECTIONS, ...FOOTER_EXTRA]) expect(keys).toContain(s.href)
    expect(keys).toContain(HOME_LATEST_KEY)
    expect(keys).not.toContain('/privacy')
    expect(keys).not.toContain('/delete-account')
  })

  it('بلا اختيار محفوظ (منصّة مدفوعة بالكامل): كلّ ما يمكن إخفاؤه مخفيّ', () => {
    expect(resolveHiddenPublic(undefined)).toEqual([...DEFAULT_HIDDEN_PUBLIC])
    expect(resolveHiddenPublic(null)).toEqual([...DEFAULT_HIDDEN_PUBLIC])
    expect([...DEFAULT_HIDDEN_PUBLIC].sort()).toEqual(HIDEABLE_PUBLIC_ENTRIES.map((e) => e.key).sort())
    for (const k of [LEVEL_PICKER_KEY, '/quizzes', '/videos', '/forum', '/library', HOME_LATEST_KEY]) expect(DEFAULT_HIDDEN_PUBLIC).toContain(k)
  })

  it('اختيار محفوظ يُعتمد وحده، ولو كان فارغًا؛ والمفاتيح المجهولة والمكرّرة تُحذف', () => {
    expect(resolveHiddenPublic([])).toEqual([])
    expect(resolveHiddenPublic(['/videos'])).toEqual(['/videos'])
    expect(cleanHiddenPublic(['/exams', '/exams', '/admin', 42, LEVEL_PICKER_KEY])).toEqual(['/exams', LEVEL_PICKER_KEY])
  })

  it('الخدمة: الافتراضيّ قبل الحفظ، ثمّ اختيار المشرف بعده؛ والتّلميذ لا يستطيع الحفظ', async () => {
    expect(await getHiddenPublicEntries(h.db)).toEqual([...DEFAULT_HIDDEN_PUBLIC])
    expect(await setHiddenPublicEntries(h.db, admin, ['/videos', '/nope'])).toEqual(['/videos'])
    expect(await getHiddenPublicEntries(h.db)).toEqual(['/videos'])
    expect(await setHiddenPublicEntries(h.db, admin, [])).toEqual([])
    expect(await getHiddenPublicEntries(h.db)).toEqual([])
    const student = await makeStudent(h.db)
    await expect(setHiddenPublicEntries(h.db, student, ['/bac'])).rejects.toThrow()
    expect(await getHiddenPublicEntries(h.db)).toEqual([])
  })
})
