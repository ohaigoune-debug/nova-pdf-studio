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

describe('imported file names (found on iPhone via TestFlight, 16 Nov)', () => {
  it('strips the import timestamp so similar books stay distinguishable', async () => {
    const { cleanImportedName } = await import('../src/platform/library')
    expect(cleanImportedName('1794842840625-الخباش_الجزء_الأول.pdf')).toBe('الخباش_الجزء_الأول.pdf')
    expect(cleanImportedName('2025 report.pdf')).toBe('2025 report.pdf')
    expect(cleanImportedName('1794842840625-')).toBe('1794842840625-')
  })
  it('native import keeps the original file name (unique folder instead of a prefix)', () => {
    const swift = readFileSync(resolve(__dirname, '../ios/App/App/Native/NovaDocumentsPlugin.swift'), 'utf8')
    expect(swift.includes('* 1000))-\\(source.lastPathComponent)')).toBe(false)
    expect(swift).toMatch(/UUID\(\)\.uuidString/)
  })
})
