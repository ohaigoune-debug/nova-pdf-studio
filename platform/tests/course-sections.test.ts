import { describe, expect, it } from 'vitest'
import { assessmentKind, buildCourseSections, classifyContent, displayTitle, parseSessionNumber } from '@/server/lib/course-sections'

const at = (day: number) => new Date(Date.UTC(2026, 9, day))
const item = (title: string, type = 'PDF', day = 1, id = title) => ({ id, title, type, publishedAt: at(day) })

describe('رقم الحصة', () => {
  it.each([
    ['الحصة 3 — مدخل إلى الشعر الحر', 3],
    ['حصة رقم 12: البلاغة', 12],
    ['الحصة ٧ - الإعراب', 7],
    ['الدرس الأول: المدرسة الرومانسية', 1],
    ['الحصة الثالثة', 3],
    ['الحصّة الثانية عشرة — مراجعة', 12],
    ['الحصة الحادية عشرة', 11],
    ['الدرس العشرون', 20],
    ['Séance 4 — exercices', 4],
    ['ملخص | الحصة 9', 9]
  ])('%s ⇒ %d', (title, n) => expect(parseSessionNumber(title)).toBe(n))

  it.each(['ملخص الدرس', 'المدرسة الرومانسية 3', 'البناء الفكري 7', 'دروس 4', 'الحصة', 'الفصل الأول', 'الحصة الحادية', ''])('%s ⇒ null', (title) => {
    expect(parseSessionNumber(title)).toBeNull()
  })
})

describe('الفروض والاختبارات', () => {
  it('الكلمة الأسبق تحكم، ولا تُطابَق الكلمات المشتقة', () => {
    expect(assessmentKind('سلسلة الفروض والاختبارات — السنة الثالثة')).toBe('homework')
    expect(assessmentKind('اختبار الفصل الأول وفرض منزلي')).toBe('tests')
    expect(assessmentKind('الإختبار التجريبي')).toBe('tests')
    expect(assessmentKind('امتحان بكالوريا 2024')).toBe('tests')
    expect(assessmentKind('Devoir n°2')).toBe('homework')
    expect(assessmentKind('Examen blanc')).toBe('tests')
    expect(assessmentKind('الفرضيات في الرياضيات')).toBeNull()
    expect(assessmentKind('Contest of testing')).toBeNull()
    expect(assessmentKind('الرمز في الشعر')).toBeNull()
  })

  it('ترتيب القرار: تقييم ثم فيديو ثم حصة/درس ثم ملف', () => {
    expect(classifyContent({ title: 'تصحيح اختبار الفصل', type: 'VIDEO' })).toBe('tests')
    expect(classifyContent({ title: 'شرح الرمز', type: 'VIDEO' })).toBe('videos')
    expect(classifyContent({ title: 'الحصة 2 — ملخص', type: 'PDF' })).toBe('lessons')
    expect(classifyContent({ title: 'ملخص بلا رقم', type: 'LESSON' })).toBe('lessons')
    expect(classifyContent({ title: 'تمرين', type: 'EXERCISE' })).toBe('lessons')
    expect(classifyContent({ title: 'جدول التوقيت', type: 'PDF' })).toBe('files')
    expect(classifyContent({ title: 'صورة', type: 'IMAGE' })).toBe('files')
  })
})

describe('عنوان العرض', () => {
  it('يحذف عبارة الحصة والفواصل الزائدة ولا يعيد فارغًا', () => {
    expect(displayTitle('الحصة 3 — مدخل إلى الشعر الحر')).toBe('مدخل إلى الشعر الحر')
    expect(displayTitle('مدخل إلى الشعر — الحصة 3')).toBe('مدخل إلى الشعر')
    expect(displayTitle('دورة الأدب | الحصة 2 | البلاغة')).toBe('دورة الأدب | البلاغة')
    expect(displayTitle('الحصة 5')).toBe('الحصة 5')
    expect(displayTitle('شرح الحصة 1 بالفيديو')).toBe('شرح الحصة 1 بالفيديو')
    expect(displayTitle('شرح الحصة 1')).toBe('شرح الحصة 1')
    expect(displayTitle('  عنوان عادي  ')).toBe('عنوان عادي')
  })
})

describe('بناء الأقسام', () => {
  it('ترتيب ثابت، والفارغ يُحذف، وكل عنصر مرة واحدة', () => {
    const items = [
      item('جدول الدورة', 'PDF', 1),
      item('الحصة 3 — البلاغة', 'PDF', 2),
      item('الحصة 1 — مدخل', 'PDF', 9),
      item('شرح الحصة 2', 'VIDEO', 3),
      item('فيديو ترحيبي', 'VIDEO', 1),
      item('الفرض الأول', 'PDF', 4),
      item('اختبار الفصل الأول', 'PDF', 5),
      item('ملخص بلا رقم', 'LESSON', 1),
      item('الحصة 2 — الإعراب', 'LESSON', 6)
    ]
    const sections = buildCourseSections(items)
    expect(sections.map((s) => s.id)).toEqual(['lessons', 'videos', 'homework', 'tests', 'files'])
    const lessons = sections[0]!.items
    expect(lessons.map((i) => i.session)).toEqual([1, 2, 3, null])
    expect(lessons.map((i) => i.displayTitle)).toEqual(['مدخل', 'الإعراب', 'البلاغة', 'ملخص بلا رقم'])
    expect(sections[1]!.items.map((i) => i.title)).toEqual(['شرح الحصة 2', 'فيديو ترحيبي'])
    const all = sections.flatMap((s) => s.items.map((i) => i.id)).sort()
    expect(all).toEqual(items.map((i) => i.id).sort())
    expect(new Set(all).size).toBe(items.length)
  })

  it('بلا تاريخ نشر يأتي آخرًا، والقائمة الفارغة لا تنتج أقسامًا', () => {
    const sections = buildCourseSections([{ id: 'a', title: 'ب', type: 'PDF', publishedAt: null }, { id: 'b', title: 'أ', type: 'PDF', publishedAt: at(2) }])
    expect(sections).toHaveLength(1)
    expect(sections[0]!.items.map((i) => i.id)).toEqual(['b', 'a'])
    expect(buildCourseSections([])).toEqual([])
  })
})
