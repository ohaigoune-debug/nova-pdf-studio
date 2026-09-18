import { Search } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { t, tEnum } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { searchWorkspace } from '@/server/services/search.service'

export default async function TeacherSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { q = '' } = await searchParams
  const r = await searchWorkspace(await getDb(), actor, q)
  const total = r.students.length + r.groups.length + r.content.length + r.assignments.length
  return (
    <>
      <PageHeader title={t('search.title')} />
      <form className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder={t('search.placeholder')} className="ps-9" autoFocus />
        </div>
        <Button type="submit">{t('common.search')}</Button>
      </form>
      {q && total === 0 ? <EmptyState icon={Search} title={t('search.noResults')} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {r.students.length ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('search.students')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {r.students.map((s) => (
                  <li key={s.id} className="py-2">
                    <Link href={`/teacher/students/${s.id}`} className="font-semibold hover:underline">
                      {s.fullName}
                    </Link>
                    <span className="ms-2 text-xs text-muted-foreground" dir="ltr">
                      {s.email}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
        {r.groups.length ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('search.groups')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {r.groups.map((g) => (
                  <li key={g.id} className="py-2">
                    <Link href={`/teacher/groups/${g.id}`} className="font-semibold hover:underline">
                      {g.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
        {r.content.length ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('search.content')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {r.content.map((c) => (
                  <li key={c.id} className="py-2">
                    <Link href={`/teacher/content/${c.id}/edit`} className="font-semibold hover:underline">
                      {c.title}
                    </Link>
                    <span className="ms-2 text-xs text-muted-foreground">{tEnum('contentTypes', c.type)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
        {r.assignments.length ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('search.assignments')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {r.assignments.map((a) => (
                  <li key={a.id} className="py-2">
                    <Link href={`/teacher/assignments/${a.id}`} className="font-semibold hover:underline">
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  )
}
