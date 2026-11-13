/** PLAY وبنك البكالوريات لتطبيق آيفون وحده (قرار المالك 13 نوفمبر 2026) */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { auditLogs } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { hubEntry, isPathHidden } from '@/lib/student-menu'
import { iosOnlyHiddenFor, isIosOnlyPublicPath, withIosOnly } from '@/lib/ios-only'
import { makeAdmin, makeStudent, setupDb } from './helpers'

const ios = vi.hoisted(() => ({ value: false }))
vi.mock('@/server/lib/ios-study', () => ({ isIosStudyOnly: async () => ios.value }))

const { playBacHiddenHere, playBacIosOnly, setPlayBacIosOnly, studentHiddenPaths } = await import('@/server/services/ios-only.service')
const { setHiddenStudentEntries } = await import('@/server/services/student-menu.service')

let h: DatabaseHandle
let admin: Actor

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
})
afterAll(async () => {
  await h.close()
})
beforeEach(() => {
  ios.value = false
})

describe('من يرى PLAY والبنك', () => {
  it('الموقع وأندرويد: مخفيان عن التلميذ والزائر؛ ظاهران في آيفون، ولفريق المنصة، وحين يُطفأ الإعداد', () => {
    expect(iosOnlyHiddenFor({ enabled: true, ios: false, role: 'STUDENT' })).toBe(true)
    expect(iosOnlyHiddenFor({ enabled: true, ios: false, role: null })).toBe(true)
    expect(iosOnlyHiddenFor({ enabled: true, ios: false, role: 'TEACHER' })).toBe(true)
    expect(iosOnlyHiddenFor({ enabled: true, ios: true, role: 'STUDENT' })).toBe(false)
    expect(iosOnlyHiddenFor({ enabled: true, ios: false, role: 'SUPER_ADMIN' })).toBe(false)
    expect(iosOnlyHiddenFor({ enabled: true, ios: false, role: 'CONTENT_UPLOADER' })).toBe(false)
    expect(iosOnlyHiddenFor({ enabled: false, ios: false, role: 'STUDENT' })).toBe(false)
  })

  it('مسارات التلميذ: PLAY بكل صفحاته والبنك؛ لا تمسّ الفروض ولا اختبارات الأستاذ ولا التدريب الحرّ', () => {
    const x = withIosOnly([], true)
    for (const p of ['/student/play', '/student/play/setup', '/student/play/bac', '/student/play/session/abc', '/bac', '/bac/123', '/student/past-bac']) expect(isPathHidden(p, x), p).toBe(true)
    for (const p of ['/student', '/student/exams', '/student/quizzes', '/student/practice', '/student/courses/x']) expect(isPathHidden(p, x), p).toBe(false)
    expect(withIosOnly(['/student/files'], false)).toEqual(['/student/files'])
    expect(withIosOnly(['/student/files', '/bac'], true).filter((p) => p === '/bac')).toHaveLength(1)
  })

  it('الصفحات العامة: ‎/play و‎/bac والمسارات القديمة التي تحوّل إليه', () => {
    for (const p of ['/play', '/bac', '/bac/abc', '/BAC/', '/past-bac', '/archive', '/archive/9']) expect(isIosOnlyPublicPath(p), p).toBe(true)
    for (const p of ['/', '/exams', '/lessons', '/library', '/playground', '/bacalaureat']) expect(isIosOnlyPublicPath(p), p).toBe(false)
  })

  it('باب «PLAY» يصير «تدرّب» ويفتح «فروض واختبارات» حين يُخفى PLAY؛ ويختفي إن خُفيت تبويباته كلها', () => {
    expect(hubEntry('train', [])).toEqual({ href: '/student/play', label: 'PLAY', iconKey: 'Gamepad2' })
    expect(hubEntry('train', withIosOnly([], true))).toEqual({ href: '/student/exams', label: 'تدرّب', iconKey: 'Target' })
    expect(hubEntry('train', ['/student/play', '/student/exams', '/bac', '/student/quizzes', '/student/practice'])).toBeNull()
    // الأبواب الأخرى لا تتأثر
    expect(hubEntry('courses', withIosOnly([], true))?.href).toBe('/student/courses')
    expect(hubEntry('account', withIosOnly([], true))?.label).toBe('حسابي')
  })
})

describe('الإعداد من الإدارة', () => {
  it('مفعّل افتراضيًّا: الموقع يخفيهما، وتطبيق آيفون يُبقيهما', async () => {
    expect(await playBacIosOnly(h.db)).toBe(true)
    expect(await playBacHiddenHere(h.db, 'STUDENT')).toBe(true)
    expect(isPathHidden('/student/play', await studentHiddenPaths(h.db))).toBe(true)
    ios.value = true
    expect(await playBacHiddenHere(h.db, 'STUDENT')).toBe(false)
    expect(isPathHidden('/student/play', await studentHiddenPaths(h.db))).toBe(false)
  })

  it('ما أخفاه المشرف يبقى مخفيًّا في آيفون أيضًا', async () => {
    await setHiddenStudentEntries(h.db, admin, ['/student/files'])
    ios.value = true
    const x = await studentHiddenPaths(h.db)
    expect(isPathHidden('/student/files', x)).toBe(true)
    expect(isPathHidden('/bac', x)).toBe(false)
    await setHiddenStudentEntries(h.db, admin, [])
  })

  it('المشرف العام وحده يغيّره، والتغيير في سجل التدقيق، وإطفاؤه يُظهرهما في الموقع', async () => {
    const s = await makeStudent(h.db)
    await expect(setPlayBacIosOnly(h.db, s, false)).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'FORBIDDEN')
    await setPlayBacIosOnly(h.db, admin, false)
    expect(await playBacIosOnly(h.db)).toBe(false)
    expect(await playBacHiddenHere(h.db, 'STUDENT')).toBe(false)
    expect(await studentHiddenPaths(h.db)).toEqual([])
    const [log] = await h.db.select().from(auditLogs).where(eq(auditLogs.action, 'settings.play_bac_ios_only'))
    expect(log?.oldValue).toEqual({ iosOnly: true })
    expect(log?.newValue).toEqual({ iosOnly: false })
    await setPlayBacIosOnly(h.db, admin, true)
    expect(await playBacHiddenHere(h.db, null)).toBe(true)
  })
})

describe('حراس في الشيفرة', () => {
  const root = join(__dirname, '..', 'src')
  const read = (p: string) => readFileSync(join(root, p), 'utf8')
  const walk = (dir: string): string[] => readdirSync(join(root, dir)).flatMap((n) => {
    const p = join(dir, n)
    return statSync(join(root, p)).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : []
  })

  it('كل مدخل يُحرس في الخادم: تخطيط التلميذ، وتخطيط PLAY، وتخطيط البنك، وصفحة ‎/play العامة', () => {
    expect(read('app/student/layout.tsx')).toMatch(/studentHiddenPaths\(db\)/)
    expect(read('app/student/play/layout.tsx')).toMatch(/isPathHidden\('\/student\/play', await studentHiddenPaths/)
    expect(read('app/(public)/bac/layout.tsx')).toMatch(/playBacHiddenHere\(/)
    expect(read('app/(public)/play/page.tsx')).toMatch(/playBacHiddenHere\(/)
    // ترويسة الزوار وتذييلهم يقرآن الأقسام من MAIN_SECTIONS
    expect(read('app/(public)/layout.tsx')).toMatch(/bacHidden && s\.href === '\/bac'/)
    expect(read('components/layout/app-shell.tsx')).toMatch(/studentHiddenPaths\(/)
  })

  it('أي صفحة للتلميذ أو للزوار تربط إلى PLAY أو البنك تسأل الإعداد أولًا', () => {
    const files = [...walk('app/student'), ...walk('app/(public)')]
      .filter((p) => !/^app\/student\/play\/|^app\/\(public\)\/(bac|play|past-bac|archive)\//.test(p))
      .filter((p) => /href[=:]\s*\{?\s*[`'"](\/bac|\/student\/play)(?![\w-])|href:\s*playHref/.test(read(p)))
    // المكتبة، وسؤال المكتبة، والرئيسية، وصفحة الدورة على الأقل
    expect(files.length).toBeGreaterThanOrEqual(4)
    console.info('صفحات تربط إلى PLAY أو البنك:', files.join('، '))
    for (const p of files) expect(read(p), p).toMatch(/studentHiddenPaths|playBacHiddenHere|show\('\/student\/play'\)/)
  })

  it('واجهات آيفون الأصلية لا تقرأ هذا الإعداد', () => {
    for (const p of walk('app/api/v1/ios')) expect(read(p), p).not.toMatch(/ios-only|playBacIosOnly|studentHiddenPaths/)
  })
})
