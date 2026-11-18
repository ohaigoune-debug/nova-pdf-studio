import { describe, expect, it } from 'vitest'
import { ADMIN_TOOLS, navFor, type NavItem } from '@/components/layout/nav'

const leaves = (items: NavItem[]): NavItem[] => items.flatMap((item) => item.children?.length ? leaves(item.children) : [item])

const PREVIOUS_DESTINATIONS = [
  '/admin', '/admin/teachers', '/admin/students', '/admin/users', '/admin/groups', '/admin/publish',
  '/admin/curriculum', '/admin/bac-bank', '/admin/play', '/admin/exam-engine', '/admin/educators',
  '/admin/content', '/admin/store', '/admin/store/confirm', '/admin/delivery', '/admin/support',
  '/admin/live', '/admin/courses', '/admin/market', '/admin/ai', '/admin/storage', '/admin/security',
  '/admin/logs', '/admin/settings', '/admin/notifications'
]

describe('قائمة الإدارة المختصرة', () => {
  it('خمسة مداخل رئيسية بالترتيب المطلوب (تبسيط 1 نوفمبر 2026)', () => {
    const main = navFor('SUPER_ADMIN')[0]!.items
    expect(main.map((i) => i.label)).toEqual(['الرئيسية', 'الدورات والدروس', 'التلاميذ', 'الطلبات', 'الإعدادات'])
    expect(main.map((i) => i.href)).toEqual(['/admin', '/admin/courses', '/admin/students', '/admin/store', '/admin/settings'])
  })

  it('الطلبات تجمع طلبات الدورات وطابور التأكيد والتوصيل؛ الإعدادات تجمع الموظفين والفيديو والأمان', () => {
    const items = navFor('SUPER_ADMIN')[0]!.items
    const orders = items.find((i) => i.href === '/admin/store')!
    expect(orders.children?.map((i) => i.href)).toEqual(['/admin/store', '/admin/store/confirm', '/admin/delivery', '/admin/points-of-sale', '/admin/affiliates', '/admin/scope-requests', '/admin/invoices', '/admin/store/cod-blocks'])
    expect(orders.children?.map((i) => i.label)).toEqual(['طلبات الدورات', 'طابور التأكيد', 'التوصيل', 'نقاط البيع', 'المسوّقون', 'طلبات تغيير الشعبة', 'الفواتير', 'ممنوعون من الدفع عند الاستلام'])
    expect(items.find((i) => i.href === '/admin/settings')!.children?.map((i) => i.href)).toEqual([
      '/admin/settings', '/admin/employees', '/admin/settings/video', '/admin/settings/payment', '/admin/settings/support-ai', '/admin/settings/student-menu',
      '/admin/settings/apps', '/admin/security', '/admin/storage', '/admin/ai', '/admin/tools'
    ])
  })

  it('الحصص المباشرة داخل الدورات، والشكاوى وكشف التسريب داخل التلاميذ (16 نوفمبر 2026)', () => {
    const items = navFor('SUPER_ADMIN')[0]!.items
    expect(items.find((i) => i.href === '/admin/courses')!.children?.map((i) => i.href)).toEqual(['/admin/courses', '/admin/live'])
    expect(items.find((i) => i.href === '/admin/students')!.children?.map((i) => i.href)).toEqual(['/admin/students', '/admin/support', '/admin/security/leaks'])
  })

  it('لا «مزيد» في القائمة: قسم واحد بخمسة أبواب، وكل الوجهات السابقة محفوظة في القائمة أو في أدوات متقدمة', () => {
    const sections = navFor('SUPER_ADMIN')
    expect(sections).toHaveLength(1)
    expect(sections.some((s) => s.collapsible)).toBe(false)
    const inMenu = leaves(sections.flatMap((s) => s.items)).map((i) => i.href)
    expect(new Set(inMenu).size).toBe(inMenu.length)
    const tools = ADMIN_TOOLS.map((x) => x.href)
    expect(new Set(tools).size).toBe(tools.length)
    for (const href of tools) expect(inMenu, href).not.toContain(href)
    for (const href of PREVIOUS_DESTINATIONS) expect([...inMenu, ...tools], href).toContain(href)
    for (const href of ['/admin/play', '/admin/exam-engine', '/admin/educators', '/admin/market']) expect(inMenu).not.toContain(href)
    expect(inMenu).toContain('/admin/employees')
  })

  it('«أدوات متقدمة» تبقى مضاءة في كل صفحة من صفحاتها', () => {
    const settings = navFor('SUPER_ADMIN')[0]!.items.find((i) => i.href === '/admin/settings')!
    const tools = settings.children!.find((i) => i.href === '/admin/tools')!
    expect(tools.also).toEqual(ADMIN_TOOLS.map((x) => x.href))
  })

  it('لا يغير قائمة التلميذ والأستاذ والمساعد', () => {
    for (const role of ['STUDENT', 'TEACHER', 'ASSISTANT'] as const) {
      const sections = navFor(role)
      expect(sections.some((s) => s.collapsible)).toBe(false)
      expect(sections.flatMap((s) => s.items).some((i) => i.children?.length)).toBe(false)
    }
  })
})
