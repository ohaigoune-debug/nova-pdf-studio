import type { UserRole } from '@/server/db/schema/enums'
import { t } from '@/i18n'

/** iconKey = اسم أيقونة lucide (PascalCase) يُحلّ في العميل */
export interface NavItem {
  href: string
  label: string
  iconKey: string
  exact?: boolean
}

export interface NavSection {
  title?: string
  items: NavItem[]
}

export function navFor(role: UserRole): NavSection[] {
  switch (role) {
    case 'STUDENT':
      return [
        {
          items: [
            { href: '/student', label: t('nav.home'), iconKey: 'Home', exact: true },
            { href: '/student/attendance/card', label: t('nav.attendanceCard'), iconKey: 'QrCode' },
            { href: '/student/groups', label: t('nav.myGroups'), iconKey: 'UsersRound' },
            { href: '/student/attendance', label: t('nav.attendance'), iconKey: 'CalendarCheck', exact: true }
          ]
        },
        {
          title: 'التعلّم',
          items: [
            { href: '/student/lessons', label: t('nav.myLessons'), iconKey: 'BookOpen' },
            { href: '/student/assignments', label: t('nav.assignments'), iconKey: 'ClipboardList' },
            { href: '/student/quizzes', label: t('nav.quizzes'), iconKey: 'ListChecks' },
            { href: '/student/past-bac', label: t('nav.pastBac'), iconKey: 'Archive' },
            { href: '/student/grades', label: t('nav.grades'), iconKey: 'GraduationCap' },
            { href: '/student/progress', label: t('nav.progress'), iconKey: 'TrendingUp' },
            { href: '/student/files', label: t('nav.files'), iconKey: 'FolderOpen' }
          ]
        },
        {
          title: 'الحساب',
          items: [
            { href: '/student/notifications', label: t('common.notifications'), iconKey: 'BellRing' },
            { href: '/student/profile', label: t('common.profile'), iconKey: 'UserRound' }
          ]
        }
      ]
    case 'TEACHER':
      return [
        {
          items: [
            { href: '/teacher', label: t('nav.dashboard'), iconKey: 'LayoutDashboard', exact: true },
            { href: '/teacher/scanner', label: t('nav.scanner'), iconKey: 'ScanLine' },
            { href: '/teacher/sessions', label: t('nav.sessions'), iconKey: 'CalendarCheck' },
            { href: '/teacher/attendance', label: t('nav.attendance'), iconKey: 'ListChecks' }
          ]
        },
        {
          title: 'الإدارة',
          items: [
            { href: '/teacher/groups', label: t('common.groups'), iconKey: 'UsersRound' },
            { href: '/teacher/students', label: t('nav.students'), iconKey: 'Users' },
            { href: '/teacher/codes', label: t('nav.codes'), iconKey: 'KeyRound' },
            { href: '/teacher/assistants', label: t('nav.assistants'), iconKey: 'UserCog' }
          ]
        },
        {
          title: 'التعليم',
          items: [
            { href: '/teacher/assignments', label: t('nav.assignments'), iconKey: 'ClipboardList' },
            { href: '/teacher/quizzes', label: t('nav.quizzes'), iconKey: 'ListChecks' },
            { href: '/teacher/rubrics', label: t('rubrics.title'), iconKey: 'ClipboardCheck' },
            { href: '/teacher/content', label: t('nav.content'), iconKey: 'BookOpen' },
            { href: '/teacher/files', label: t('nav.files'), iconKey: 'FolderOpen' },
            { href: '/teacher/reports', label: t('nav.reports'), iconKey: 'BarChart3' },
            { href: '/teacher/ai-insights', label: t('nav.aiInsights'), iconKey: 'Brain' }
          ]
        },
        {
          title: 'الحساب',
          items: [
            { href: '/teacher/notifications', label: t('common.notifications'), iconKey: 'BellRing' },
            { href: '/teacher/settings', label: t('nav.settings'), iconKey: 'Settings' }
          ]
        }
      ]
    case 'ASSISTANT':
      return [
        {
          items: [
            { href: '/assistant', label: t('nav.dashboard'), iconKey: 'LayoutDashboard', exact: true },
            { href: '/assistant/scanner', label: t('nav.scanner'), iconKey: 'ScanLine' },
            { href: '/assistant/sessions', label: t('nav.sessions'), iconKey: 'CalendarCheck' },
            { href: '/assistant/attendance', label: t('nav.attendance'), iconKey: 'ListChecks' },
            { href: '/assistant/students', label: t('nav.students'), iconKey: 'Users' }
          ]
        },
        {
          title: 'الحساب',
          items: [
            { href: '/assistant/notifications', label: t('common.notifications'), iconKey: 'BellRing' },
            { href: '/assistant/settings', label: t('nav.settings'), iconKey: 'Settings' }
          ]
        }
      ]
    case 'SUPER_ADMIN':
      return [
        {
          items: [
            { href: '/admin', label: t('nav.dashboard'), iconKey: 'LayoutDashboard', exact: true },
            { href: '/admin/teachers', label: t('nav.teachers'), iconKey: 'GraduationCap' },
            { href: '/admin/students', label: t('nav.students'), iconKey: 'Users' },
            { href: '/admin/users', label: t('nav.users'), iconKey: 'UserRound' },
            { href: '/admin/groups', label: t('common.groups'), iconKey: 'UsersRound' }
          ]
        },
        {
          title: 'المنصة',
          items: [
            { href: '/admin/content', label: t('nav.content'), iconKey: 'FileText' },
            { href: '/admin/ai', label: t('nav.ai'), iconKey: 'Cpu' },
            { href: '/admin/storage', label: t('nav.storage'), iconKey: 'HardDrive' },
            { href: '/admin/security', label: t('nav.security'), iconKey: 'Shield' },
            { href: '/admin/logs', label: t('nav.logs'), iconKey: 'ScrollText' },
            { href: '/admin/settings', label: t('nav.settings'), iconKey: 'Settings' }
          ]
        },
        { title: 'الحساب', items: [{ href: '/admin/notifications', label: t('common.notifications'), iconKey: 'BellRing' }] }
      ]
    default:
      return []
  }
}
