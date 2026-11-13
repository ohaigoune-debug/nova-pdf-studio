/**
 * البند ب2 (13 نوفمبر 2026): صفحة درس واحدة للتلميذ.
 * الصفحات الثلاث (حساب التلميذ، والعامة، وتطبيق آيفون) تستعمل LessonView، وآيفون بلا شارات ولا روابط ولا أي إشارة إلى شراء.
 */
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
// LessonMedia يستورد خدمات الخادم (server-only)؛ في الاختبار يكفي تجاوز الحارس
vi.mock('server-only', () => ({}))

import { LESSON_SURFACES, LessonView, type LessonSurface, type LessonViewItem } from '@/components/domain/lesson-view'

const item: LessonViewItem = {
  id: '00000000-0000-0000-0000-000000000001',
  slug: 'lesson-1',
  type: 'LESSON',
  title: 'الصورة الشعرية عند البارودي',
  summary: 'ملخص الدرس',
  body: '## الفكرة العامة\n- أولًا\n- ثانيًا\nفقرة الشرح',
  levelName: 'السنة الثالثة ثانوي',
  topic: 'الأدب',
  authorName: 'الدكتور حيقون أسامة',
  publishedAt: new Date('2026-11-10T09:00:00Z'),
  externalUrl: 'https://example.com/landing',
  videoProvider: null,
  youtubeId: null,
  allowDownload: false,
  fileId: null,
  fileMime: null,
  fileStatus: null,
  fileName: null
}

const render = (surface: LessonSurface, over: Partial<LessonViewItem> = {}, extra: { extras?: string; footer?: string } = {}) =>
  renderToStaticMarkup(
    createElement(LessonView, {
      item: { ...item, ...over },
      actor: null,
      surface,
      back: { href: surface === 'ios' ? '/ios' : '/lessons', label: 'رجوع' },
      extras: extra.extras ? createElement('div', null, extra.extras) : null,
      footer: extra.footer ? createElement('div', null, extra.footer) : null
    })
  )

describe('LessonView', () => {
  it('كل مسار: العنوان والملخص والنص بالعرض نفسه، ورابط الرجوع', () => {
    for (const s of ['student', 'public', 'ios'] as const) {
      const html = render(s)
      expect(html).toContain(`data-lesson-surface="${s}"`)
      expect(html).toContain(item.title)
      expect(html).toContain('ملخص الدرس')
      expect(html).toContain('الفكرة العامة')
      expect(html).toContain('<li>أولًا</li>')
      expect(html).toContain('رجوع')
    }
  })

  it('التلميذ والعام: الشارات والكاتب ورابط «فتح الرابط»', () => {
    for (const s of ['student', 'public'] as const) {
      const html = render(s)
      expect(html).toContain('السنة الثالثة ثانوي')
      expect(html).toContain('الدكتور حيقون أسامة')
      expect(html).toContain('فتح الرابط')
    }
  })

  it('آيفون: لا شارات ولا روابط خارجية ولا أي إشارة إلى شراء أو سعر', () => {
    const html = render('ios', { body: 'نص الدرس' })
    expect(html).not.toContain('السنة الثالثة ثانوي')
    expect(html).not.toContain('example.com')
    expect(html).not.toContain('فتح الرابط')
    expect(html).not.toMatch(/دج|شراء|اشترِ|اشتر |سعر|الدفع|اطلب الدورة/)
    expect(LESSON_SURFACES.ios).toEqual({ meta: false, links: false, wide: false })
  })

  it('درس بلا نص ولا وسائط: «المحتوى سيُضاف قريبًا» في كل مسار', () => {
    for (const s of ['student', 'public', 'ios'] as const) expect(render(s, { body: null })).toContain('المحتوى سيُضاف قريبًا')
  })

  it('اختبار الدرس والتعليقات في مكانهما حين يُمرَّران', () => {
    const html = render('student', {}, { extras: 'زر الاختبار', footer: 'التعليقات' })
    expect(html.indexOf('زر الاختبار')).toBeGreaterThan(html.indexOf('ملخص الدرس'))
    expect(html.indexOf('التعليقات')).toBeGreaterThan(html.indexOf('فقرة الشرح'))
  })

  it('PDF مع فيديو: صفحة أعرض للتلميذ والعام، وآيفون بلا قيد عرض', () => {
    const both = { videoProvider: 'YOUTUBE', youtubeId: 'dQw4w9WgXcQ', fileMime: 'application/pdf' } as const
    expect(render('public', both)).toContain('max-w-6xl')
    expect(render('public')).toContain('max-w-3xl')
    expect(render('ios', both)).not.toMatch(/max-w-(6xl|3xl)/)
  })
})

describe('الصفحات الثلاث تستعمل المكوّن نفسه', () => {
  const read = (p: string) => readFileSync(new URL(`../src/app/${p}`, import.meta.url), 'utf8')
  const pages = { student: 'student/lessons/[slug]/page.tsx', public: '(public)/lessons/[slug]/page.tsx', ios: 'ios/lesson/[slug]/page.tsx' } as const

  it('كل صفحة تمرّر مسارها، ولا تعرض الوسائط أو النص بنفسها', () => {
    for (const [surface, p] of Object.entries(pages)) {
      const src = read(p)
      expect(src).toContain(`surface="${surface}"`)
      expect(src).not.toMatch(/<LessonMedia|<Markdown|renderBody/)
    }
  })

  it('الاختبار والتعليقات في صفحة التلميذ وحدها', () => {
    expect(read(pages.student)).toMatch(/LessonQuizButton[\s\S]*LessonComments/)
    expect(read(pages.public)).not.toMatch(/LessonQuizButton|LessonComments/)
    expect(read(pages.ios)).not.toMatch(/LessonQuizButton|LessonComments/)
  })
})
