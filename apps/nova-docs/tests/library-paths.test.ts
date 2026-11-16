/**
 * يحمي من خطأ حقيقي ظهر على محاكي iOS: مكتبة الملفات الأصلية (IONFilesystemLib) تعامل أي مسار غير موجود
 * بلا امتداد كمجلد، فتفشل كتابة الملف المؤقت. كل المسارات المؤقتة يجب أن تحمل امتدادًا.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const src = (f: string) => readFileSync(resolve(__dirname, '../src', f), 'utf8')

describe('iOS filesystem path rules', () => {
  it('temporary library file has an explicit extension', () => {
    const m = src('platform/library.ts').match(/const temp = `([^`]+)`/)
    expect(m).toBeTruthy()
    expect(m![1]).toMatch(/\.\w+$/)
  })
  it('database temp file has an explicit extension', () => {
    expect(src('platform/db.ts')).toMatch(/const tmp = `\$\{FILE\}\.tmp`/)
    expect(src('platform/db.ts')).toMatch(/FILE = 'NovaData\/nova\.sqlite'/)
  })
})
