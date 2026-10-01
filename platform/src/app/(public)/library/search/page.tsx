import { Search } from 'lucide-react'
import Link from 'next/link'
import { LibraryHits } from '@/components/domain/library-hits'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import { getDb } from '@/server/db/client'
import { asc } from 'drizzle-orm'
import { levels, subjects } from '@/server/db/schema'
import { LIBRARY_SECTIONS, librarySearch, type LibrarySectionKey } from '@/server/services/library.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'بحث في المكتبة' }

type Q = { q?: string; subject?: string; level?: string; section?: string }

export default async function LibrarySearchPage({ searchParams }: { searchParams: Promise<Q> }) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const section = LIBRARY_SECTIONS.some((s) => s.key === sp.section) ? (sp.section as LibrarySectionKey) : null
  const db = await getDb()
  const [subjectRows, levelRows, r] = await Promise.all([db.select({ id: subjects.id, name: subjects.nameAr }).from(subjects).orderBy(asc(subjects.sortOrder)), db.select({ id: levels.id, name: levels.nameAr }).from(levels).orderBy(asc(levels.sortOrder)), q ? librarySearch(db, { q, subjectId: sp.subject || null, levelId: sp.level || null, section }) : Promise.resolve({ hits: [], total: 0 })])
  const opts = { subjects: subjectRows, levels: levelRows }
  const href = (patch: Partial<Q>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v)
    const s = p.toString()
    return `/library/search${s ? `?${s}` : ''}`
  }
  return (
    <div className="container py-10">
      <PageHeader title="بحث في المكتبة" description={q ? `${r.total} نتيجة لـ«${q}»` : 'اكتب كلمة أو درساً أو سنة بكالوريا.'} actions={<Button asChild variant="outline" size="sm"><Link href="/library">المكتبة</Link></Button>} />
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <input type="hidden" name="section" value={section ?? ''} />
        <div className="relative">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="ابحث…" className="ps-9" dir="auto" autoFocus={!q} />
        </div>
        <Select name="subject" defaultValue={sp.subject ?? ''} aria-label="المادة">
          <option value="">كل المواد</option>
          {opts.subjects.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <Select name="level" defaultValue={sp.level ?? ''} aria-label="الصف">
          <option value="">كل الصفوف</option>
          {opts.levels.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <Button type="submit">بحث</Button>
      </form>
      <nav className="mb-6 flex flex-wrap gap-2 text-sm" aria-label="القسم">
        <Link href={href({ section: '' })} className={cn('rounded-full border px-3 py-1.5', !section ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')}>
          الكل
        </Link>
        {LIBRARY_SECTIONS.map((s) => (
          <Link key={s.key} href={href({ section: s.key })} className={cn('rounded-full border px-3 py-1.5', section === s.key ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')}>
            {s.label}
          </Link>
        ))}
      </nav>
      {q ? <LibraryHits hits={r.hits} empty="لا نتائج بهذه الكلمات. جرّب كلمة أقصر أو ألغِ القيود." /> : null}
    </div>
  )
}
