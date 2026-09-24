/**
 * مخبأ نصوص المستندات على القرص الدائم: استخراج نصّ PDF مكلف، والملف نفسه لا يتغيّر
 * ما دام مفتاحه (معرّف + تاريخ تعديل، أو بصمة المحتوى) ثابتاً.
 */
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

function cacheDir(): string {
  return path.resolve(process.cwd(), process.env.DRIVE_CACHE_DIR ?? 'data/drive-cache')
}

export async function cachedText(key: string, produce: () => Promise<string>): Promise<string> {
  const p = path.join(cacheDir(), `${createHash('sha256').update(key).digest('hex')}.txt`)
  try {
    return await fs.readFile(p, 'utf8')
  } catch {
    const text = await produce()
    await fs.mkdir(cacheDir(), { recursive: true })
    await fs.writeFile(p, text, 'utf8')
    return text
  }
}
