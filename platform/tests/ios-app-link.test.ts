import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isAppleMobile, parseAppStoreLink } from '@/lib/ios-app'

describe('رابط تطبيق الآيفون في App Store (16 نوفمبر 2026)', () => {
  it('يقبل الرابط كما يُنسخ من App Store ويستخرج رقم التطبيق', () => {
    expect(parseAppStoreLink('https://apps.apple.com/dz/app/madrasa/id6754321098?platform=iphone')).toEqual({
      url: 'https://apps.apple.com/dz/app/madrasa/id6754321098',
      id: '6754321098'
    })
    expect(parseAppStoreLink('  https://apps.apple.com/app/id6754321098/  ')).toEqual({ url: 'https://apps.apple.com/app/id6754321098', id: '6754321098' })
  })

  it('يقبل رقم التطبيق وحده', () => {
    expect(parseAppStoreLink('6754321098')).toEqual({ url: 'https://apps.apple.com/app/id6754321098', id: '6754321098' })
  })

  it('يرفض أي رابط آخر أو بلا رقم', () => {
    for (const bad of ['', 'http://apps.apple.com/app/id6754321098', 'https://evil.example/app/id6754321098', 'https://apps.apple.com.evil.dz/app/id6754321098', 'https://apps.apple.com/dz/app/madrasa', 'javascript:alert(1)', 'abc']) {
      expect(parseAppStoreLink(bad), bad).toBeNull()
    }
  })

  it('يكشف الآيفون والآيباد من بصمة المتصفح', () => {
    expect(isAppleMobile('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15')).toBe(true)
    expect(isAppleMobile('Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36')).toBe(false)
    expect(isAppleMobile(null)).toBe(false)
  })

  it('الزر لا يظهر داخل التطبيقين، وصفحة الإعداد للمشرف وحده', () => {
    const service = readFileSync('src/server/services/ios-app.service.ts', 'utf8')
    expect(service).toContain('isIosStudyOnly()')
    expect(service).toContain("h.get('x-madrasa-app') === '1'")
    expect(existsSync('src/app/admin/settings/apps/page.tsx')).toBe(true)
    expect(readFileSync('src/app/admin/settings/apps/page.tsx', 'utf8')).toContain("requirePageActor('SUPER_ADMIN')")
  })
})
