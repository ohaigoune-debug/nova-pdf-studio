/**
 * MADRASA PLAY — بوابة صور الشخصيات (12_MANDATORY_ACCEPTANCE_GATES): لا بطاقة مصوّرة بلا ملف محلي حقيقي
 * ومصدر وترخيص وإسناد وتأكيد بشري للهوية. الحالة الراهنة تُقرأ من content/play-portraits/manifest.json.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mediaProblems } from '@/server/play/exams/engine'
import { imageSize } from '../scripts/play/fetch-portraits'

interface Entry {
  slug: string
  local_path: string
  source_url: string
  license: string | null
  attribution: string | null
  image_verified_at: string | null
  sha256: string | null
  status: string
  blocker: string | null
}
const manifest = JSON.parse(readFileSync(join(process.cwd(), 'content/play-portraits/manifest.json'), 'utf-8')) as { portraits: Entry[] }
const asMedia = (e: Entry) => ({ local_path: e.local_path, source_url: e.source_url, attribution: e.attribution ?? '', license: e.license ?? '', image_verified_at: e.image_verified_at, sha256: e.sha256, width: null, height: null, depicts: '', alt: '' })

describe('portrait manifest', () => {
  it('lists the three figures from the owner package, each with a Commons source page', () => {
    expect(manifest.portraits.map((p) => p.slug)).toEqual(['larbi-ben-mhidi', 'hassiba-ben-bouali', 'didouche-mourad'])
    for (const p of manifest.portraits) expect(p.source_url).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/)
  })

  it('an entry is "ready" only if the media gate passes; otherwise it is blocked with a reason', () => {
    for (const p of manifest.portraits) {
      const problems = mediaProblems(asMedia(p), join(process.cwd(), 'public'))
      if (p.status === 'ready') expect(problems, p.slug).toEqual([])
      else {
        expect(p.status).toBe('needs_media_review')
        expect(problems.length, p.slug).toBeGreaterThan(0)
        expect(p.blocker, p.slug).toBeTruthy()
      }
    }
  })
})

describe('image header parsing used by the fetch script', () => {
  it('reads PNG and JPEG dimensions and rejects other bytes', () => {
    const png = Buffer.alloc(24)
    png[0] = 0x89
    png.write('PNG', 1, 'ascii')
    png.writeUInt32BE(480, 16)
    png.writeUInt32BE(600, 20)
    expect(imageSize(png)).toEqual({ width: 480, height: 600 })
    // JPEG: SOI, APP0 (len 16), SOF0 (len 17, precision, h=500, w=400)
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...Array(14).fill(0), 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xf4, 0x01, 0x90, ...Array(12).fill(0)])
    expect(imageSize(jpg)).toEqual({ width: 400, height: 500 })
    expect(imageSize(Buffer.from('not an image'))).toBeNull()
  })
})
