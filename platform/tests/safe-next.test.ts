import { describe, expect, it } from 'vitest'
import { safeNextPath } from '@/server/lib/safe-next'

describe('وجهة ما بعد الدخول', () => {
  it('تقبل المسارات الداخلية فقط', () => {
    expect(safeNextPath('/student/profile#delete')).toBe('/student/profile#delete')
    expect(safeNextPath('/')).toBe('/')
    for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'evil.com', '', null, undefined]) expect(safeNextPath(bad)).toBeNull()
  })
})
