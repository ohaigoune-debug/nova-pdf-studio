import { FileText } from 'lucide-react'
import Link from 'next/link'
import { LevelSubjectBar, ResourceCards } from '@/components/domain/resource-cards'
import { Button } from '@/components/ui/button'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { currentLevel, subjectsForLevel } from '@/server/queries/level-scope'
import { listResourceCards, PRACTICE_KINDS, practiceCounts, type PracticeKind } from '@/server/services/library.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'الفروض والاختبارات' }

type Q = { level?: string; subject?: string; kind?: string; q?: string; cursor?: string }

/**
 * /exams — الفروض والاختبارات والتمارين لكل المستويات (4 متوسط، 1 ثانوي…)، مرشّحة بمستوى الزائر والمادة.
 * مواضيع البكالوريا الرسمية لها قسمها (/bac) فلا تتكرّر هنا.
 */
export default async function ExamsPage({ searchParams }: { searchParams: Promise<Q> }) {
  const sp = await searchParams
  const db = await getDb()
  const [level, actor] = await Promise.all([currentLevel(db, sp.level), getCurrentActor()])
  const studentId = actor?.studentId ?? null
  const subjectId = sp.subject && /^[0-9a-f-]{36}$/i.test(sp.subject) ? sp.subject : null
  const kind = PRACTICE_KINDS.find((k) => k.key === sp.kind) ?? null
  const scope = { levelId: level?.id ?? null, subjectId, excludeBac: true, studentId }
  const allTypes = PRACTICE_KINDS.flatMap((k) => k.types)
  const [list, counts, subjectOpts] = await Promise.all([listResourceCards(db, { ...scope, types: kind ? [...kind.types] : allTypes, q: sp.q ?? null }, { cursor: sp.cursor ?? null, limit: 24 }), practiceCounts(db, scope), subjectsForLevel(db, level?.id ?? null)])
  const link = (patch: Partial<Q>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, cursor: undefined, ...patch }).filter((e): e is [string, string] => Boolean(e[1])))
    const s = p.toString()
    return `/exams${s ? `?${s}` : ''}`
  }
  const total = Object.values(counts).reduce((a, n) => a + n, 0)
  const chip = (on: boolean) => cn('rounded-full border px-3 py-1.5 text-sm font-semibold', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')
  return (
    <div className="container py-10">
      <PageHeader title="الفروض والاختبارات" description={`فروض واختبارات الفصول وسلاسل التمارين مع تصحيحاتها${level ? ` — ${level.label}` : ' لكل المستويات'}. مواضيع البكالوريا في «بنك البكالوريات السابقة».`} />
      <LevelSubjectBar action="/exams" levelLabel={level?.label ?? null} subjects={subjectOpts} subjectId={subjectId} q={sp.q} hidden={{ kind: sp.kind, level: sp.level }} placeholder="ابحث: فرض الفصل الأول، الدوال، الإعراب…" />

      <nav className="mb-5 flex flex-wrap gap-2" aria-label="النوع">
        <Link href={link({ kind: undefined })} className={chip(!kind)}>
          الكل ({total})
        </Link>
        {PRACTICE_KINDS.map((k) => (
          <Link key={k.key} href={link({ kind: k.key })} className={chip(kind?.key === k.key)}>
            {k.label} ({counts[k.key as PracticeKind]})
          </Link>
        ))}
      </nav>

      {list.items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="لا فروض ولا اختبارات بهذه المرشّحات بعد"
          description={level ? `جرّب مادة أخرى أو «كل المستويات». يضيف المشرف الفروض والاختبارات من المكتبة تباعاً.` : 'يضيف المشرف الفروض والاختبارات من المكتبة تباعاً.'}
          action={
            level ? (
              <Button asChild variant="outline">
                <Link href="/exams?level=all">كل المستويات</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">{list.total} نتيجة</p>
          <ResourceCards items={list.items} />
        </>
      )}
      {list.nextCursor ? (
        <div className="mt-6 text-center">
          <Button asChild variant="outline">
            <Link href={`${link({})}${link({}).includes('?') ? '&' : '?'}cursor=${list.nextCursor}`}>المزيد</Link>
          </Button>
        </div>
      ) : null}
    </div>
  )
}
