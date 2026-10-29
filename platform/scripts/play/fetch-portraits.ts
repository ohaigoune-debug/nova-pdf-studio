/**
 * MADRASA PLAY — تنزيل صور الشخصيات التاريخية من Wikimedia Commons والتحقق منها (10_HISTORICAL_PORTRAITS).
 *
 *   npx tsx scripts/play/fetch-portraits.ts                 → ينزّل كل صورة غير موجودة، ويسجّل الترخيص والإسناد وsha256 والأبعاد
 *   npx tsx scripts/play/fetch-portraits.ts --confirm larbi-ben-mhidi --by "د. حيقون"
 *                                                           → بعد النظر في الصورة: تأكيد بشري لهوية الشخص (image_verified_at)
 *
 * يُشغَّل على جهاز يصل إلى commons.wikimedia.org (جهاز المالك، أو بيئة العمل بعد السماح بالنطاق).
 * يرفض أي ملف بلا ترخيص مسموح (ملكية عامة، CC0، CC BY، CC BY-SA) أو بلا إسناد. لا يولّد صورًا ولا يضع بدائل.
 * بلا تأكيد بشري تبقى الحالة needs_media_review ولا تُعرض أي بطاقة مصوّرة.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const ROOT = process.cwd()
const MANIFEST = join(ROOT, 'content/play-portraits/manifest.json')
const ALLOWED = [/^public domain$/i, /^pd/i, /^cc0/i, /^cc by(-sa)? \d/i, /^cc-by(-sa)?-\d/i]
const UA = 'MadrasaPLAY/1.0 (madrasadz.com; portraits for an educational quiz)'

interface Portrait {
  slug: string
  commons_file: string
  source_url: string
  local_path: string
  license: string | null
  attribution: string | null
  image_verified_at: string | null
  verified_by: string | null
  sha256: string | null
  width: number | null
  height: number | null
  downloaded_at: string | null
  status: string
  blocker: string | null
}

const strip = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

/** أبعاد JPEG/PNG من الترويسة (دون مكتبات) */
export function imageSize(buf: Buffer): { width: number; height: number } | null {
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i < buf.length) {
      if (buf[i] !== 0xff) return null
      const marker = buf[i + 1]!
      const len = buf.readUInt16BE(i + 2)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
      i += 2 + len
    }
  }
  return null
}

async function fetchOne(p: Portrait): Promise<Portrait> {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size|sha1|extmetadata&iiurlwidth=600&titles=${encodeURIComponent(p.commons_file)}`
  const meta = (await (await fetch(api, { headers: { 'User-Agent': UA } })).json()) as { query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; url: string; extmetadata?: Record<string, { value: string }> }[] }> } }
  const info = Object.values(meta.query?.pages ?? {})[0]?.imageinfo?.[0]
  if (!info) throw new Error(`${p.slug}: الملف غير موجود في Commons`)
  const ext = info.extmetadata ?? {}
  const license = strip(ext.LicenseShortName?.value ?? '')
  const artist = strip(ext.Artist?.value ?? '')
  const credit = strip(ext.Credit?.value ?? '')
  if (!license || !ALLOWED.some((r) => r.test(license))) throw new Error(`${p.slug}: ترخيص غير مسموح أو مفقود (${license || '—'})`)
  const imgUrl = info.thumburl ?? info.url
  const res = await fetch(imgUrl, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${p.slug}: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const size = imageSize(buf)
  if (!size || size.width < 120) throw new Error(`${p.slug}: ليست صورة صالحة`)
  const file = join(ROOT, 'public', p.local_path.replace(/^\/+/, ''))
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, buf)
  return {
    ...p,
    license,
    attribution: [artist || 'مؤلف غير معروف', credit].filter(Boolean).join(' — ') + ' — Wikimedia Commons',
    sha256: createHash('sha256').update(buf).digest('hex'),
    width: size.width,
    height: size.height,
    downloaded_at: new Date().toISOString(),
    // التأكيد البشري للهوية خطوة منفصلة (--confirm)
    image_verified_at: null,
    verified_by: null,
    status: 'needs_media_review',
    blocker: 'نُزّلت الصورة وسُجّل ترخيصها؛ تنتظر تأكيد هوية الشخص بعد النظر فيها (--confirm).'
  }
}

async function main() {
  const doc = JSON.parse(readFileSync(MANIFEST, 'utf-8')) as { portraits: Portrait[] }
  const argv = process.argv.slice(2)
  const ci = argv.indexOf('--confirm')
  if (ci >= 0) {
    const slug = argv[ci + 1]
    const by = argv[argv.indexOf('--by') + 1]
    const p = doc.portraits.find((x) => x.slug === slug)
    if (!p || !by || argv.indexOf('--by') < 0) throw new Error('الاستعمال: --confirm <slug> --by <الاسم>')
    const file = join(ROOT, 'public', p.local_path.replace(/^\/+/, ''))
    if (!existsSync(file) || !p.sha256 || !p.license) throw new Error(`${slug}: نزّل الصورة أولًا`)
    if (createHash('sha256').update(readFileSync(file)).digest('hex') !== p.sha256) throw new Error(`${slug}: الملف تغيّر بعد التنزيل`)
    Object.assign(p, { image_verified_at: new Date().toISOString(), verified_by: by, status: 'ready', blocker: null })
  } else {
    for (let i = 0; i < doc.portraits.length; i++) {
      const p = doc.portraits[i]!
      if (p.sha256 && existsSync(join(ROOT, 'public', p.local_path.replace(/^\/+/, '')))) continue
      try {
        doc.portraits[i] = await fetchOne(p)
        console.log(`✓ ${p.slug}: ${doc.portraits[i]!.license} — ${doc.portraits[i]!.width}×${doc.portraits[i]!.height}`)
      } catch (e) {
        p.blocker = e instanceof Error ? e.message : String(e)
        console.log(`✗ ${p.slug}: ${p.blocker}`)
      }
    }
  }
  writeFileSync(MANIFEST, JSON.stringify(doc, null, 1) + '\n')
}

if (process.argv[1] && process.argv[1].endsWith('fetch-portraits.ts')) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
