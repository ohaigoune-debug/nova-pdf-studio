/**
 * مشغّل الفيديو كما يراه التلميذ (ملاحظات المالك من تجربة الهاتف، 11 نوفمبر 2026):
 *  - الجملة تحت المشغّل تحذير للتلميذ، لا شرح لحدود الحماية.
 *  - حجب «جهاز آخر يشاهد» لا يُرفع بضغطة زر: الخادم يُسأل أولًا.
 *  - التكبير يملأ الشاشة، فلا يبقى فيديو مصوَّر بالطول صغيرًا في إطار 16:9.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SecureBunnyPlayer, SecureYouTubePlayer } from '@/components/domain/secure-video-player'
import { t } from '@/i18n'

const source = readFileSync(join(process.cwd(), 'src', 'components', 'domain', 'secure-video-player.tsx'), 'utf8')
const watermark = ['Test Student', '…0000 · 2026-11-11']

describe('student video player', () => {
  it('shows the student a warning under the video, not a note that protection can be bypassed', () => {
    const bunny = renderToStaticMarkup(createElement(SecureBunnyPlayer, { src: 'https://iframe.mediadelivery.net/embed/1/x', expires: 4102444800, contentId: 'c1', watermark, title: 'درس' }))
    const youtube = renderToStaticMarkup(createElement(SecureYouTubePlayer, { src: 'https://www.youtube-nocookie.com/embed/x', contentId: 'c1', watermark, title: 'درس' }))
    for (const html of [bunny, youtube]) {
      expect(html).toContain('تُعرّض حسابك للإغلاق')
      expect(html).not.toContain('لا تمنعه')
      expect(html).not.toContain('تقلّل التسريب')
      expect(html).toContain('Test Student')
    }
    expect(t('media.bunnyWatermarkHint')).not.toMatch(/لا تمنعه|تقلّل/)
  })

  it('never lifts the device block locally: the retry button asks the server first', () => {
    // كان onClick={() => setBlocked(null)} يعيد تركيب الإطار فيشتغل الفيديو لحظات قبل النبضة التالية
    expect(source).not.toMatch(/onClick=\{\(\) => setBlocked\(null\)\}/)
    // كل رفع للحجب مشروط بقبول الخادم
    const lifts = [...source.matchAll(/^.*setBlocked\(null\).*$/gm)].map((m) => m[0].trim())
    expect(lifts.length).toBe(2)
    for (const line of lifts) expect(line).toBe("if (result === 'ok') setBlocked(null)")
    expect(source.match(/onClick=\{\(\) => void retry\(\)\}/g)?.length).toBe(2)
    expect(t('media.retry')).toBe('أعد المحاولة')
  })

  it('a network failure during retry keeps the block in place', () => {
    // 'error' لا يرفع الحجب: تعذّر السؤال ليس موافقة
    expect(source).toMatch(/type HeartbeatResult = 'ok' \| 'blocked' \| 'error'/)
    expect(source).not.toMatch(/result !== 'blocked'\) setBlocked\(null\)/)
  })

  it('expanded frame fills the whole screen instead of a fixed 16:9 box', () => {
    expect(source).toContain("{ width: '100vw', height: '100dvh' }")
    expect(source).not.toContain('calc(100dvh * 16 / 9)')
    // خارج التكبير يبقى الإطار 16:9 كما كان
    expect(source).toContain(": { aspectRatio: '16 / 9' }")
  })
})
