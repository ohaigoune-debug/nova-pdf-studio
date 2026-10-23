import { describe, expect, it } from 'vitest'
import { isRawDownloadAllowed } from '@/server/lib/download-policy'

describe('سياسة التنزيل الخام («ملفاتي»)', () => {
  it('لا رابط مباشر للفيديو المرفوع أو PDF حتى لو سُمح بالتنزيل، ولا لأي ملف لم يُسمح به', () => {
    expect(isRawDownloadAllowed({ allowDownload: true, mime: 'video/mp4' })).toBe(false)
    expect(isRawDownloadAllowed({ allowDownload: true, mime: 'application/pdf' })).toBe(false)
    expect(isRawDownloadAllowed({ allowDownload: false, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toBe(false)
    expect(isRawDownloadAllowed({ allowDownload: false, mime: null })).toBe(false)
  })
  it('يسمح بالملفات العادية التي أذن الأستاذ بتنزيلها', () => {
    expect(isRawDownloadAllowed({ allowDownload: true, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toBe(true)
    expect(isRawDownloadAllowed({ allowDownload: true, mime: 'image/png' })).toBe(true)
  })
})
