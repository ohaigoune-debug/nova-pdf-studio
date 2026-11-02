import type { UserRole } from '@/server/db/schema/enums'

export function homeFor(role: UserRole): string {
  switch (role) {
    case 'SUPER_ADMIN': return '/admin'
    case 'CONFIRMER': return '/admin/store/confirm'
    case 'CONTENT_UPLOADER': return '/studio'
    case 'MANAGER': return '/admin/points-of-sale'
    case 'POINT_OF_SALE': return '/pos'
    case 'TEACHER': return '/teacher'
    case 'ASSISTANT': return '/assistant'
    case 'STUDENT': return '/student'
    default: return '/'
  }
}
