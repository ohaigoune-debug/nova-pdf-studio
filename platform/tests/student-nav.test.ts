/**
 * دمج أقسام واجهة التلميذ (2026-10-23): مدخل واحد لكل مجمّع، والصفحات القديمة تبقى بمساراتها كتبويبات.
 * اختبارات بلا قاعدة: بنية القائمة، تغطية المسارات القديمة، وجود ملفات الصفحات، وروابط الإشعارات.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { navFor } from '@/components/layout/nav'
import { STUDENT_HUBS, hubPaths, type StudentHubKey } from '@/lib/student-hubs'

/** المسارات التي كانت مداخل مستقلة في القائمة قبل الدمج — يجب أن تبقى قابلة للوصول (روابط قديمة، إشعارات، التطبيق) */
const LEGACY_ENTRIES = [
  '/student/courses',
  '/student/courses/catalog',
  '/student/play',
  '/student/lessons',
  '/student/assignments',
  '/student/exams',
  '/student/quizzes',
  '/student/practice',
  '/student/grades',
  '/student/progress',
  '/student/files',
  '/student/videos'
]

/** روابط الإشعارات التي يولّدها الخادم للتلميذ (notifications.service وغيرها) */
const NOTIFICATION_LINKS = ['/student/assignments', '/student/classroom', '/student/courses', '/student/groups', '/student/lessons', '/student/quizzes']

const pageFile = (href: string) => join(process.cwd(), 'src/app', href.replace(/^\//, ''), 'page.tsx')

describe('قائمة التلميذ بعد الدمج', () => {
  const sections = navFor('STUDENT')
  const items = sections.flatMap((s) => s.items)
  const hrefs = items.map((i) => i.href)

  it('لا مدخل مكرّر، ولا تسمية مكرّرة', () => {
    expect(new Set(hrefs).size).toBe(hrefs.length)
    const labels = items.map((i) => i.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('قرار 2026-10-24: الرئيسية + الأقسام الخمسة فقط (الدروس، الفروض، بنك البكالوريات، تدرّب، الدورات)', () => {
    const main = sections[0]!
    expect(main.items.map((i) => i.href)).toEqual(['/student', STUDENT_HUBS.lessons.href, STUDENT_HUBS.exams.href, '/bac', STUDENT_HUBS.train.href, STUDENT_HUBS.courses.href])
    expect(main.items.slice(1).map((i) => i.label)).toEqual(['الدروس', 'الفروض', 'بنك البكالوريات السابقة', 'تدرّب', 'الدورات'])
    for (const key of ['lessons', 'exams', 'train', 'courses'] as StudentHubKey[]) {
      const item = main.items.find((i) => i.href === STUDENT_HUBS[key].href)!
      expect(item.also).toEqual(hubPaths(key))
    }
  })

  it('الحضور والأفواج لم يعودا في قائمة التلميذ (الصفحات باقية بمساراتها)', () => {
    for (const hidden of ['/student/attendance/card', '/student/attendance', '/student/groups', '/student/classroom', '/store']) expect(hrefs).not.toContain(hidden)
    for (const href of ['/student/attendance', '/student/attendance/card', '/student/groups']) expect(existsSync(pageFile(href)), href).toBe(true)
  })

  it('قوائم الأستاذ والمساعد بلا ماسح ولا حضور ولا أكواد', () => {
    for (const role of ['TEACHER', 'ASSISTANT'] as const) {
      const h = navFor(role)
        .flatMap((s) => s.items)
        .map((i) => i.href)
      expect(h.some((x) => /scanner|attendance|\/sessions|\/codes/.test(x)), `${role}: ${h.join(',')}`).toBe(false)
    }
  })

  it('كل مدخل قديم ما زال موجوداً كتبويب في مجمّعه وله صفحة فعلية', () => {
    const allTabs = (Object.keys(STUDENT_HUBS) as StudentHubKey[]).flatMap((k) => hubPaths(k))
    for (const href of LEGACY_ENTRIES) {
      expect(allTabs, href).toContain(href)
      expect(existsSync(pageFile(href)), `page missing: ${href}`).toBe(true)
    }
  })

  it('الواجب الشخصي والفرض العام تبويبان منفصلان في مجمّع واحد (صلاحيات مختلفة)', () => {
    expect(STUDENT_HUBS.exams.tabs.map((t) => t.href)).toEqual(['/student/exams', '/student/assignments'])
    expect(STUDENT_HUBS.train.tabs.map((t) => t.href)).toEqual(['/student/play', '/student/quizzes', '/student/practice'])
  })

  it('روابط إشعارات الخادم تشير إلى صفحات قائمة', () => {
    for (const href of NOTIFICATION_LINKS) expect(existsSync(pageFile(href)), href).toBe(true)
  })

  it('قوائم الأستاذ والمشرف لم تتغيّر بنيتها (لا مدخل مكرّر)', () => {
    for (const role of ['TEACHER', 'SUPER_ADMIN'] as const) {
      const h = navFor(role)
        .flatMap((s) => s.items)
        .map((i) => i.href)
      expect(new Set(h).size).toBe(h.length)
    }
  })
})
