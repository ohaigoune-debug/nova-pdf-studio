/**
 * حصّاد عامّ لموقع يتيح مواضيع البكالوريا (عندما يحجب DzExams الخادم): يبدأ من صفحة،
 * يتبع روابط الموقع نفسه التي توحي بالبكالوريا (bac/بكالوريا/sujet/موضوع/تصحيح/سنة)، ويجمع
 * روابط PDF (مباشرة أو ملفات Google Drive عامّة) مع نصّ الرابط وعنوان صفحته لتصنيفها لاحقاً.
 * روابط فقط هنا؛ الملف يُنزَّل عند الاستيراد ويُنسب مصدره. مهذّب: طلب واحد كل ثانية ونيّف وحدّ للصفحات.
 */
import { extractEmbeddedPdfs, extractLinks, pageTitle } from './dzexams'

export interface HarvestedPdf {
  url: string
  /** نصّ الرابط كما ظهر في الصفحة */
  text: string
  pageTitle: string
  pageUrl: string
}

export interface HarvestOptions {
  fetch?: typeof fetch
  delayMs?: number
  maxPages?: number
  maxDepth?: number
  /** روابط تُتبع فقط إن طابقت (href أو نصّه) — الافتراضي: كلمات البكالوريا والسنوات */
  follow?: RegExp
  log?: (line: string) => void
}

export interface HarvestReport {
  pages: number
  pdfs: HarvestedPdf[]
  errors: number
}

export const HARVEST_UA = 'MadrasaBot/1.0 (+https://madrasadz.com; official bac exams with source attribution)'
const DEFAULT_FOLLOW = /bac|بكالوريا|baccalaur|sujet|موضوع|مواضيع|annale|corrig|تصحيح|examen|امتحان|(?:19[89]|20[0-9])\d/i
const SKIP = /\.(?:jpe?g|png|gif|webp|svg|css|js|zip|rar|mp4|mp3|xml|json)(?:$|\?)|\/(?:tag|tags|category|login|register|signup|cart|search|feed|wp-json|wp-admin|comments?)\b|\?(?:replytocom|share)=/i

/** رابط ملف Google Drive عامّ ← رابط تنزيل مباشر */
export function driveDownloadUrl(href: string): string | null {
  const m = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=download&)?id=)([A-Za-z0-9_-]{10,})/.exec(href) ?? /docs\.google\.com\/(?:document|presentation)\/d\/([A-Za-z0-9_-]{10,})/.exec(href)
  return m ? `https://drive.google.com/uc?export=download&id=${m[1]}` : null
}

export function isPdfLink(href: string): boolean {
  return /\.pdf(?:$|\?|#)/i.test(href) || Boolean(driveDownloadUrl(href))
}

export async function harvestSite(seedUrl: string, opts: HarvestOptions = {}): Promise<HarvestReport> {
  const doFetch = opts.fetch ?? fetch
  const delay = opts.delayMs ?? 1200
  const maxPages = opts.maxPages ?? 300
  const maxDepth = opts.maxDepth ?? 3
  const follow = opts.follow ?? DEFAULT_FOLLOW
  const log = opts.log ?? (() => {})
  const seed = new URL(seedUrl)
  const host = seed.hostname.replace(/^www\./, '')
  const sameSite = (u: string) => {
    try {
      return new URL(u).hostname.replace(/^www\./, '') === host
    } catch {
      return false
    }
  }
  const norm = (u: string) => {
    const x = new URL(u)
    x.hash = ''
    return x.toString()
  }
  const seenPages = new Set<string>()
  const seenPdfs = new Set<string>()
  const report: HarvestReport = { pages: 0, pdfs: [], errors: 0 }
  const queue: { url: string; depth: number }[] = [{ url: norm(seedUrl), depth: 0 }]
  seenPages.add(norm(seedUrl))
  let last = 0
  while (queue.length && report.pages < maxPages) {
    const { url, depth } = queue.shift()!
    const wait = last + delay - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    last = Date.now()
    let html: string
    try {
      const res = await doFetch(url, { headers: { 'user-agent': HARVEST_UA, accept: 'text/html,application/xhtml+xml', 'accept-language': 'ar,fr;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(30_000) })
      if (!res.ok) throw new Error(String(res.status))
      const ct = (res.headers.get('content-type') ?? '').toLowerCase()
      if (!ct.includes('html')) continue
      html = await res.text()
    } catch (e) {
      report.errors++
      log(`✖ ${url}: ${e instanceof Error ? e.message : String(e)}`)
      continue
    }
    report.pages++
    const title = pageTitle(html)
    const links = extractLinks(html, url)
    let found = 0
    const addPdf = (href: string, text: string) => {
      const dl = driveDownloadUrl(href) ?? href
      if (seenPdfs.has(dl)) return
      seenPdfs.add(dl)
      report.pdfs.push({ url: dl, text, pageTitle: title, pageUrl: url })
      found++
    }
    for (const l of links) if (isPdfLink(l.href)) addPdf(l.href, l.text)
    for (const p of extractEmbeddedPdfs(html, url)) addPdf(p, '')
    if (depth < maxDepth)
      for (const l of links) {
        if (!sameSite(l.href) || SKIP.test(l.href) || isPdfLink(l.href)) continue
        const n = norm(l.href)
        if (seenPages.has(n) || !(follow.test(l.href) || follow.test(l.text))) continue
        seenPages.add(n)
        queue.push({ url: n, depth: depth + 1 })
      }
    log(`• ${title || url}: ${found} ملف PDF، ${queue.length} صفحة في الانتظار`)
  }
  log(`تمّ: ${report.pages} صفحة، ${report.pdfs.length} ملف PDF، أخطاء ${report.errors}`)
  return report
}
