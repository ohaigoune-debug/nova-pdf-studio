/**
 * عارض PDF في دروس الدورات: يرسم الصفحات داخل الصفحة ولا يعتمد على iframe، لأن كروم أندرويد
 * وSafari على الهاتف لا يعرضان PDF داخل إطار (فراغ أو تنزيل للملف).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SecurePdfViewer } from '@/components/domain/secure-pdf-viewer'

const render = (allowDownload: boolean) =>
  renderToStaticMarkup(createElement(SecurePdfViewer, { src: '/api/v1/media/abc', contentId: 'c1', allowDownload, watermark: ['تلميذ تجريبي', '0661000000'], track: false }))

describe('lesson pdf viewer', () => {
  it('renders no iframe, object or embed for the pdf', () => {
    const html = render(false)
    expect(html).not.toMatch(/<iframe|<object|<embed/)
    // حالة التحميل الأولى لعارض الصفحات
    expect(html).toContain('جارٍ تحميل المعاينة')
  })

  it('keeps the viewer watermark overlay and the protection notice', () => {
    const html = render(false)
    expect(html).toContain('تلميذ تجريبي')
    expect(html).toContain('0661000000')
  })

  it('offers a download link only when the teacher allows it', () => {
    expect(render(false)).not.toContain('download=""')
    expect(render(true)).toContain('download=""')
  })

  it('lesson media still routes every pdf through this viewer', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'components', 'domain', 'lesson-media.tsx'), 'utf8')
    expect(src).toContain('<SecurePdfViewer')
    expect(src).not.toMatch(/<iframe[^>]*pdf/i)
  })
})
