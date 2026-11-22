/** التحويل من Route Handlers بمسار نسبي: خلف الوكيل req.url = https://0.0.0.0:3000 (حادثة ربط Zoom، 22 نوفمبر 2026) */
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { GET as referral } from '@/app/r/[code]/route'
import { REF_COOKIE } from '@/lib/referral'
import { redirectPath } from '@/server/lib/relative-redirect'

describe('redirectPath', () => {
  it('Location نسبي دائمًا، ولا تحويل إلى نطاق آخر', () => {
    expect(redirectPath('/admin/live?zoom=connected').headers.get('location')).toBe('/admin/live?zoom=connected')
    expect(redirectPath('/login').status).toBe(307)
    expect(redirectPath('//evil.example').headers.get('location')).toBe('/')
    expect(redirectPath('https://evil.example').headers.get('location')).toBe('/')
  })
})

describe('رابط الدعوة /r/CODE خلف الوكيل', () => {
  it('يبقى الزائر على النطاق الذي جاء منه (لا 0.0.0.0:3000)', async () => {
    const req = new NextRequest('https://0.0.0.0:3000/r/ABC123')
    const res = await referral(req, { params: Promise.resolve({ code: 'ABC123' }) })
    const loc = res.headers.get('location') ?? ''
    expect(loc.startsWith('/register')).toBe(true)
    expect(loc).not.toContain('0.0.0.0')
    expect(res.headers.get('set-cookie') ?? '').toContain(`${REF_COOKIE}=`)
  })

  it('?to=/مسار داخلي يُحترم، والخارجي يُتجاهل', async () => {
    const ok = await referral(new NextRequest('https://0.0.0.0:3000/r/ABC123?to=/go/dawra'), { params: Promise.resolve({ code: 'ABC123' }) })
    expect(ok.headers.get('location')).toBe('/go/dawra')
    const bad = await referral(new NextRequest('https://0.0.0.0:3000/r/ABC123?to=https://evil.example'), { params: Promise.resolve({ code: 'ABC123' }) })
    expect(bad.headers.get('location')?.startsWith('/register')).toBe(true)
  })
})
