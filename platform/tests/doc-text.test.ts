import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { extractDocText, isTextExtractable } from '@/server/lib/doc-text'
import { ALLOWED_MIME } from '@/server/lib/storage'
import { mimeOf } from '@/lib/file-types'

const slide = (paras: string[]) =>
  `<?xml version="1.0"?><p:sld xmlns:a="a" xmlns:p="p"><p:cSld><p:spTree>${paras.map((t) => `<a:p><a:r><a:t>${t}</a:t></a:r></a:p>`).join('')}</p:spTree></p:cSld></p:sld>`

describe('نصوص ملفات الدروس', () => {
  it('PowerPoint: فقرات الشرائح بترتيبها الرقمي', async () => {
    const zip = new JSZip()
    zip.file('ppt/slides/slide10.xml', slide(['الشريحة العاشرة']))
    zip.file('ppt/slides/slide2.xml', slide(['الكناية لفظ أريد به لازم معناه', 'مثال &amp; تطبيق']))
    zip.file('ppt/slides/slide1.xml', slide(['درس الصور البيانية']))
    const bytes = await zip.generateAsync({ type: 'uint8array' })
    const text = await extractDocText(bytes, 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
    expect(text.split('\n').filter(Boolean)).toEqual(['درس الصور البيانية', 'الكناية لفظ أريد به لازم معناه', 'مثال & تطبيق', 'الشريحة العاشرة'])
  })

  it('صيغ أوفيس كلّها تُرفع، والقديمة لا تُقرأ، والنوع من الامتداد إن غاب', () => {
    for (const m of ['application/msword', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']) expect(ALLOWED_MIME.has(m)).toBe(true)
    expect(isTextExtractable('application/msword')).toBe(false)
    expect(isTextExtractable('application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe(true)
    expect(mimeOf({ name: 'درس.PPTX', type: '' })).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation')
    expect(mimeOf({ name: 'x.doc', type: '' })).toBe('application/msword')
  })
})
