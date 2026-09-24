/**
 * قراءة صفحات DzExams (مواضيع البكالوريا وتصحيحاتها) دون مكتبة HTML:
 * روابط <a> ونصوصها تكفي، والبنية المتوقّعة مرنة:
 *   /ar/bac                     ← المواد:   /ar/bac/<مادة>
 *   /ar/bac/<مادة>[/<شعبة>]     ← المواضيع: /ar/annales/<معرّف>  (وقد تكون مرقّمة ?page=N)
 *   /ar/annales/<معرّف>          ← روابط التنزيل (PDF) للموضوع والتصحيح
 * لا يُخزَّن أي ملف: روابط فقط، والمصدر مذكور.
 */
export const DZ_BASE = 'https://www.dzexams.com'

export interface Link {
  href: string
  text: string
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))

const strip = (html: string) =>
  decode(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()

/** كل الروابط بعنوان مطلق ونصّ مقروء (نص الرابط، وإلا title/aria-label) */
export function extractLinks(html: string, base = DZ_BASE): Link[] {
  const out: Link[] = []
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = m[1] ?? ''
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue
    let abs: string
    try {
      abs = new URL(decode(href), base).toString()
    } catch {
      continue
    }
    const label = strip(m[2] ?? '') || decode(/\b(?:title|aria-label)\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] ?? '')
    out.push({ href: abs, text: label })
  }
  return out
}

/** روابط PDF خارج <a>: iframe/embed/object ومصادر data-* الشائعة في عارضات PDF */
export function extractEmbeddedPdfs(html: string, base = DZ_BASE): string[] {
  const out: string[] = []
  for (const m of html.matchAll(/\b(?:src|data|data-src|data-url|data-file|data-pdf)\s*=\s*["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi)) {
    try {
      out.push(new URL(decode(m[1]!), base).toString())
    } catch {
      /* رابط تالف */
    }
  }
  return [...new Set(out)]
}

const pathOf = (u: string) => {
  try {
    const url = new URL(u)
    return url.hostname.endsWith('dzexams.com') ? url.pathname.replace(/\/+$/, '') : null
  } catch {
    return null
  }
}

/** /ar/bac/<مادة> — المواد من صفحة الفهرس */
export function subjectLinks(links: Link[], lang = 'ar'): { slug: string; name: string; url: string }[] {
  const seen = new Map<string, { slug: string; name: string; url: string }>()
  for (const l of links) {
    const m = new RegExp(`^/${lang}/bac/([a-z0-9-]+)$`).exec(pathOf(l.href) ?? '')
    if (!m || !l.text) continue
    if (!seen.has(m[1]!)) seen.set(m[1]!, { slug: m[1]!, name: l.text, url: `${DZ_BASE}/${lang}/bac/${m[1]}` })
  }
  return [...seen.values()]
}

/** /ar/bac/<مادة>/<شعبة> — شُعب المادة */
export function streamLinks(links: Link[], subject: string, lang = 'ar'): { slug: string; name: string; url: string }[] {
  const seen = new Map<string, { slug: string; name: string; url: string }>()
  for (const l of links) {
    const m = new RegExp(`^/${lang}/bac/${subject}/([a-z0-9-]+)$`).exec(pathOf(l.href) ?? '')
    if (!m) continue
    if (!seen.has(m[1]!)) seen.set(m[1]!, { slug: m[1]!, name: l.text || m[1]!, url: `${DZ_BASE}/${lang}/bac/${subject}/${m[1]}` })
  }
  return [...seen.values()]
}

/** /ar/annales/<معرّف> — المواضيع المدرجة في صفحة، بنصوصها */
export function annaleLinks(links: Link[], lang = 'ar'): Link[] {
  const seen = new Map<string, Link>()
  for (const l of links) {
    const p = pathOf(l.href)
    if (!p || !new RegExp(`^/${lang}/annales/[A-Za-z0-9=_-]+$`).test(p)) continue
    const url = `${DZ_BASE}${p}`
    const prev = seen.get(url)
    // الرابط نفسه قد يتكرّر (صورة ثم عنوان): يُحتفظ بأطول نصّ
    if (!prev || l.text.length > prev.text.length) seen.set(url, { href: url, text: l.text })
  }
  return [...seen.values()]
}

/** صفحات الترقيم التالية: ?page=N أو /page/N */
export function paginationLinks(links: Link[], pageUrl: string): string[] {
  const base = pathOf(pageUrl)
  const out = new Set<string>()
  for (const l of links) {
    const p = pathOf(l.href)
    if (!p || !base) continue
    const u = new URL(l.href)
    if ((p === base && /^\d+$/.test(u.searchParams.get('page') ?? '')) || new RegExp(`^${base}/page/\\d+$`).test(p)) out.add(u.toString())
  }
  return [...out]
}

const CORRECTION = /corrig|correction|solution|تصحيح|الحل|حل /i

/** روابط التنزيل في صفحة موضوع: PDF أو «تحميل/download»، مفصولة موضوعاً وتصحيحاً */
export function downloadLinks(html: string): { examUrl: string | null; correctionUrl: string | null; all: string[] } {
  const links = extractLinks(html)
  const cands: { url: string; label: string }[] = []
  for (const l of links) {
    const isPdf = /\.pdf(\?|$)/i.test(l.href)
    const isDl = /download|telecharg|تحميل|تنزيل/i.test(`${l.href} ${l.text}`)
    if (isPdf || isDl) cands.push({ url: l.href, label: `${l.text} ${l.href}` })
  }
  for (const u of extractEmbeddedPdfs(html)) cands.push({ url: u, label: u })
  const uniq = [...new Map(cands.map((c) => [c.url, c])).values()].filter((c) => !/\/(ar|fr|en)\/(bac|annales)\/?$/.test(pathOf(c.url) ?? ''))
  const correction = uniq.find((c) => CORRECTION.test(c.label))
  const exam = uniq.find((c) => c !== correction && !CORRECTION.test(c.label)) ?? null
  return { examUrl: exam?.url ?? null, correctionUrl: correction?.url ?? null, all: uniq.map((c) => c.url) }
}

/** السنة من العنوان («بكالوريا 2024») */
export function yearOf(title: string): number | null {
  const years = [...title.matchAll(/\b(19[89]\d|20[0-4]\d)\b/g)].map((m) => Number(m[1]))
  return years.length ? Math.max(...years) : null
}

/** الشعبة من العنوان («شعبة ل.أ»، «شعبة آداب وفلسفة») إن لم تأتِ من صفحة الشعبة */
export function streamOf(title: string): string | null {
  const m = /شعب(?:ة|تي)\s+([^–\-|]+?)(?:\s+مع|\s+–|\s+-|\s*\||$)/.exec(title)
  return m ? m[1]!.trim() : null
}

/** عنوان الصفحة (<h1> ثم <title>) مقطوعاً عند «|» */
export function pageTitle(html: string): string {
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]
  return strip(h1 ?? title ?? '')
    .split('|')[0]!
    .trim()
}
