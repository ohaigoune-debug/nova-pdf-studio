/**
 * زاحف مهذّب لمواضيع البكالوريا في DzExams: طلب واحد كل ثانية تقريباً، هوية واضحة،
 * ولا يعيد زيارة موضوع محفوظ إلا بطلب صريح (refresh). النتيجة روابط في جدول bac_exams.
 */
import { sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { bacExams } from '@/server/db/schema'
import { annaleLinks, downloadLinks, DZ_BASE, extractLinks, pageTitle, paginationLinks, streamLinks, streamOf, subjectLinks, yearOf } from './dzexams'

export interface SyncOptions {
  fetch?: typeof fetch
  /** بين الطلبات، بالمللي ثانية */
  delayMs?: number
  /** مواد محدّدة فقط (slugs)، وإلا كلّها */
  subjects?: string[]
  /** يعيد زيارة المواضيع المحفوظة لتحديث روابطها */
  refresh?: boolean
  /** تجربة: لا كتابة، ويطبع ما وجده */
  dry?: boolean
  maxPagesPerListing?: number
  maxExams?: number
  log?: (line: string) => void
}

export interface SyncReport {
  subjects: number
  listings: number
  found: number
  saved: number
  withDirectLink: number
  errors: number
}

// ترويسات HTTP بايتات لاتينية فقط: أي حرف عربي هنا يُسقط كل الطلبات
const UA = 'MadrasaBot/1.0 (+https://madrasadz.com; bac exam links with source attribution)'

/** موادّ احتياطية إن لم تُقرأ صفحة الفهرس (المعروفة من روابط DzExams العامة) */
const FALLBACK_SUBJECTS = [
  ['arabe', 'اللغة العربية وآدابها'],
  ['mathematiques', 'الرياضيات'],
  ['physique', 'العلوم الفيزيائية'],
  ['sciences-naturelles', 'علوم الطبيعة والحياة'],
  ['francais', 'اللغة الفرنسية'],
  ['anglais', 'اللغة الإنجليزية'],
  ['histoire-geographie', 'التاريخ والجغرافيا'],
  ['philosophie', 'الفلسفة'],
  ['sciences-islamiques', 'العلوم الإسلامية'],
  ['comptabilite', 'التسيير المحاسبي والمالي'],
  ['economie', 'الاقتصاد والمناجمنت'],
  ['droit', 'القانون']
] as const

export async function syncBacExams(db: Db | null, opts: SyncOptions = {}): Promise<SyncReport> {
  const doFetch = opts.fetch ?? fetch
  const delay = opts.delayMs ?? 1200
  const log = opts.log ?? (() => {})
  const report: SyncReport = { subjects: 0, listings: 0, found: 0, saved: 0, withDirectLink: 0, errors: 0 }
  let last = 0

  const get = async (url: string): Promise<string | null> => {
    const wait = last + delay - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    last = Date.now()
    try {
      const res = await doFetch(url, { headers: { 'user-agent': UA, accept: 'text/html', 'accept-language': 'ar,fr;q=0.8' }, signal: AbortSignal.timeout(30_000) })
      if (!res.ok) {
        report.errors++
        log(`✖ ${res.status} ${url}`)
        return null
      }
      return await res.text()
    } catch (e) {
      report.errors++
      log(`✖ ${url} — ${e instanceof Error ? e.message : String(e)}`)
      return null
    }
  }

  // ١) المواد
  const index = await get(`${DZ_BASE}/ar/bac`)
  let subjects = index ? subjectLinks(extractLinks(index)) : []
  if (subjects.length === 0) {
    log('! لم تُقرأ المواد من الفهرس — تُستعمل القائمة الاحتياطية')
    subjects = FALLBACK_SUBJECTS.map(([slug, name]) => ({ slug, name, url: `${DZ_BASE}/ar/bac/${slug}` }))
  }
  if (opts.subjects?.length) subjects = subjects.filter((s) => opts.subjects!.includes(s.slug))
  report.subjects = subjects.length
  log(`المواد (${subjects.length}): ${subjects.map((s) => s.slug).join('، ')}`)

  const known = new Set<string>()
  if (db && !opts.refresh) for (const r of await db.select({ u: bacExams.pageUrl }).from(bacExams)) known.add(r.u)

  // ٢) المواضيع في كل مادة وشُعبها وصفحات ترقيمها
  const maxPages = opts.maxPagesPerListing ?? 25
  const maxExams = opts.maxExams ?? Infinity
  let visited = 0
  for (const s of subjects) {
    const queue: { url: string; stream: { slug: string; name: string } | null }[] = [{ url: s.url, stream: null }]
    const seenListing = new Set<string>()
    const exams = new Map<string, { title: string; stream: { slug: string; name: string } | null }>()
    while (queue.length) {
      const item = queue.shift()!
      if (seenListing.has(item.url) || seenListing.size >= maxPages * 8) continue
      seenListing.add(item.url)
      const html = await get(item.url)
      if (!html) continue
      report.listings++
      const links = extractLinks(html)
      for (const a of annaleLinks(links)) {
        const prev = exams.get(a.href)
        // الشعبة من صفحة الشعبة أدقّ من صفحة المادة العامة
        if (!prev || (!prev.stream && item.stream)) exams.set(a.href, { title: a.text || prev?.title || '', stream: item.stream ?? prev?.stream ?? null })
      }
      if (!item.stream) for (const st of streamLinks(links, s.slug)) queue.push({ url: st.url, stream: { slug: st.slug, name: st.name } })
      const pages = paginationLinks(links, item.url).slice(0, maxPages)
      for (const p of pages) queue.push({ url: p, stream: item.stream })
    }
    log(`• ${s.slug}: ${exams.size} موضوعاً في ${seenListing.size} صفحة`)
    report.found += exams.size

    // ٣) صفحة كل موضوع: روابط التنزيل المباشر
    for (const [pageUrl, meta] of exams) {
      if (visited >= maxExams) break
      if (known.has(pageUrl)) continue
      visited++
      const html = await get(pageUrl)
      if (!html) continue
      const title = meta.title || pageTitle(html)
      const dl = downloadLinks(html)
      if (dl.examUrl || dl.correctionUrl) report.withDirectLink++
      const row = {
        source: 'dzexams',
        subjectSlug: s.slug,
        subjectName: s.name,
        streamSlug: meta.stream?.slug ?? null,
        streamName: meta.stream?.name ?? streamOf(title),
        year: yearOf(title),
        title: title.slice(0, 300) || `${s.name}`,
        pageUrl,
        examUrl: dl.examUrl,
        correctionUrl: dl.correctionUrl,
        fetchedAt: new Date()
      }
      if (opts.dry) {
        log(`  ${row.year ?? '—'} | ${row.streamName ?? '—'} | ${row.title}\n    الموضوع: ${row.examUrl ?? '— (صفحة فقط)'}\n    التصحيح: ${row.correctionUrl ?? '—'}${dl.all.length > 2 ? `\n    روابط أخرى: ${dl.all.slice(0, 5).join(' ')}` : ''}`)
        continue
      }
      if (!db) continue
      await db
        .insert(bacExams)
        .values(row)
        .onConflictDoUpdate({
          target: bacExams.pageUrl,
          set: { title: row.title, year: row.year, streamSlug: row.streamSlug, streamName: row.streamName, examUrl: row.examUrl, correctionUrl: row.correctionUrl, fetchedAt: row.fetchedAt, updatedAt: sql`now()` }
        })
      report.saved++
    }
  }
  log(`تمّ: ${report.found} موضوعاً، حُفظ ${report.saved}، منها ${report.withDirectLink} برابط تنزيل مباشر، أخطاء ${report.errors}`)
  return report
}
