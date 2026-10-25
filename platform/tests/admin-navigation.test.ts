import { describe, expect, it } from 'vitest'
import { navFor, type NavItem } from '@/components/layout/nav'

const leaves = (items: NavItem[]): NavItem[] => items.flatMap((item) => item.children?.length ? leaves(item.children) : [item])

const PREVIOUS_DESTINATIONS = [
  '/admin', '/admin/teachers', '/admin/students', '/admin/users', '/admin/groups', '/admin/publish',
  '/admin/curriculum', '/admin/bac-bank', '/admin/play', '/admin/exam-engine', '/admin/educators',
  '/admin/content', '/admin/store', '/admin/store/confirm', '/admin/delivery', '/admin/support',
  '/admin/live', '/admin/courses', '/admin/market', '/admin/ai', '/admin/storage', '/admin/security',
  '/admin/logs', '/admin/settings', '/admin/notifications'
]

describe('قائمة الإدارة المختصرة', () => {
  it('ستة مداخل رئيسية بالترتيب المطلوب', () => {
    const main = navFor('SUPER_ADMIN')[0]!.items
    expect(main.map((i) => i.label)).toEqual(['الرئيسية', 'الطلبات', 'التوصيل', 'الدورات', 'الموظفون', 'الإعدادات'])
    expect(main.map((i) => i.href)).toEqual(['/admin', '/admin/store', '/admin/delivery', '/admin/courses', '/admin/employees', '/admin/settings'])
  })

  it('الطلبات تجمع قائمة طلبات الدورات وطابور التأكيد', () => {
    const orders = navFor('SUPER_ADMIN')[0]!.items.find((i) => i.href === '/admin/store')!
    expect(orders.children?.map((i) => i.href)).toEqual(['/admin/store', '/admin/store/confirm'])
    expect(orders.children?.map((i) => i.label)).toEqual(['طلبات الدورات', 'طابور التأكيد'])
  })

  it('المزيد قابل للطي ويحافظ على كل الوجهات السابقة دون تكرار', () => {
    const sections = navFor('SUPER_ADMIN')
    const more = sections.find((s) => s.title === 'المزيد')
    expect(more?.collapsible).toBe(true)
    const all = leaves(sections.flatMap((s) => s.items)).map((i) => i.href)
    expect(new Set(all).size).toBe(all.length)
    for (const href of PREVIOUS_DESTINATIONS) expect(all).toContain(href)
    expect(all).toContain('/admin/employees')
  })

  it('لا يغير قائمة التلميذ والأستاذ والمساعد', () => {
    for (const role of ['STUDENT', 'TEACHER', 'ASSISTANT'] as const) {
      const sections = navFor(role)
      expect(sections.some((s) => s.collapsible)).toBe(false)
      expect(sections.flatMap((s) => s.items).some((i) => i.children?.length)).toBe(false)
    }
  })
})
