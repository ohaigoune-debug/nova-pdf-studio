import { Lock, MessageSquareText, MessagesSquare, Pin, Search } from 'lucide-react'
import Link from 'next/link'
import { NewThreadForm } from '@/components/domain/forum'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { arCount, REPLIES } from '@/lib/ar-count'
import { formatDateTime } from '@/lib/utils'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { currentLevel, pickerLevelRows, subjectsForLevel } from '@/server/queries/level-scope'
import { canWriteForum, forumStats, listThreads } from '@/server/services/forum.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'المنتدى' }

type Q = { level?: string; subject?: string; q?: string; mine?: string; cursor?: string }

/** المنتدى العامّ: كل التلاميذ (بكود أستاذ أم بدونه) وكل الأساتذة يتناقشون؛ الزائر يقرأ */
export default async function ForumPage({ searchParams }: { searchParams: Promise<Q> }) {
  const sp = await searchParams
  const db = await getDb()
  const [actor, level] = await Promise.all([getCurrentActor(), currentLevel(db, sp.level)])
  const subjectId = sp.subject && /^[0-9a-f-]{36}$/i.test(sp.subject) ? sp.subject : null
  const mine = Boolean(actor && sp.mine === '1')
  const [list, stats, subjectOpts, levelRows] = await Promise.all([
    listThreads(db, actor, { levelId: level?.id ?? null, subjectId, q: sp.q ?? null, authorUserId: mine ? actor!.userId : null }, { cursor: sp.cursor ?? null, limit: 20 }),
    forumStats(db),
    subjectsForLevel(db, level?.id ?? null),
    pickerLevelRows(db)
  ])
  const writer = canWriteForum(actor)
  const link = (patch: Partial<Q>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, cursor: undefined, ...patch }).filter((e): e is [string, string] => Boolean(e[1])))
    const s = p.toString()
    return `/forum${s ? `?${s}` : ''}`
  }
  return (
    <div className="container py-10">
      <PageHeader
        title="المنتدى"
        description={
          <>
            ساحة نقاش مفتوحة لكل التلاميذ — انضممت إلى أستاذ بكود أم لا — ولكل الأساتذة: اسأل، أجب، وتبادل الطرائق. {arCount(stats.threads, ['موضوع', 'موضوعان', 'مواضيع', 'موضوعاً'])} · {arCount(stats.posts, REPLIES)}
            {level ? ` · المستوى: ${level.label}` : ''}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="min-w-0 space-y-4">
          <form action="/forum" className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_12rem_auto]">
            {sp.level ? <input type="hidden" name="level" value={sp.level} /> : null}
            {mine ? <input type="hidden" name="mine" value="1" /> : null}
            <div className="relative">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" defaultValue={sp.q ?? ''} placeholder="ابحث في المواضيع…" className="ps-9" dir="auto" />
            </div>
            <Select name="subject" defaultValue={subjectId ?? ''} aria-label="المادة">
              <option value="">كل المواد</option>
              {subjectOpts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="outline">
              بحث
            </Button>
          </form>
          {actor ? (
            <div className="flex gap-2 text-sm">
              <Link href={link({ mine: undefined })} className={!mine ? 'font-bold text-primary' : 'text-muted-foreground hover:text-foreground'}>
                كل المواضيع
              </Link>
              <span className="text-muted-foreground">·</span>
              <Link href={link({ mine: '1' })} className={mine ? 'font-bold text-primary' : 'text-muted-foreground hover:text-foreground'}>
                مواضيعي
              </Link>
            </div>
          ) : null}

          {list.items.length === 0 ? (
            <EmptyState icon={MessagesSquare} title={sp.q || subjectId || mine ? 'لا مواضيع مطابقة' : 'لا مواضيع بعد'} description={writer ? 'كن أوّل من يطرح سؤالاً في هذا القسم.' : 'سجّل دخولك لتطرح أوّل سؤال.'} />
          ) : (
            <ul className="space-y-2.5">
              {list.items.map((t) => (
                <li key={t.id}>
                  <Link href={`/forum/${t.id}`} className="block rounded-xl border bg-card p-4 transition-colors hover:border-primary/50">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="min-w-0 font-bold leading-snug">
                        {t.pinned ? <Pin className="me-1 inline size-4 text-primary" aria-label="مثبّت" /> : null}
                        {t.status === 'LOCKED' ? <Lock className="me-1 inline size-4 text-muted-foreground" aria-label="مقفل" /> : null}
                        {t.title}
                      </h2>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <MessageSquareText className="size-4" /> {t.repliesCount}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground" dir="auto">
                      {t.excerpt}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                      <Badge variant={t.author.role === 'TEACHER' ? 'gold' : 'muted'}>
                        {t.author.badge}: {t.author.name}
                      </Badge>
                      {t.subject ? <Badge variant="outline">{t.subject.name}</Badge> : null}
                      {t.level ? <Badge variant="default">{t.level.label}</Badge> : null}
                      {t.status === 'HIDDEN' ? <Badge variant="destructive">مخفي</Badge> : null}
                      <span className="ms-auto text-muted-foreground">آخر نشاط {formatDateTime(t.lastPostAt)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {list.nextCursor ? (
            <div className="text-center">
              <Button asChild variant="outline">
                <Link href={`${link({})}${link({}).includes('?') ? '&' : '?'}cursor=${list.nextCursor}`}>مواضيع أقدم</Link>
              </Button>
            </div>
          ) : null}
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">موضوع جديد</CardTitle>
            </CardHeader>
            <CardContent>
              {writer ? (
                <NewThreadForm subjects={subjectOpts} levels={levelRows.map((l) => ({ id: l.id, name: l.label }))} defaultLevelId={level?.id ?? null} />
              ) : actor ? (
                <p className="text-sm text-muted-foreground">الكتابة في المنتدى للتلاميذ والأساتذة.</p>
              ) : (
                <div className="space-y-3 text-sm">
                  <p className="text-muted-foreground">القراءة متاحة للجميع. لتطرح سؤالاً أو تجيب، سجّل دخولك — لا يلزمك كود أستاذ.</p>
                  <div className="flex gap-2">
                    <Button asChild size="sm">
                      <Link href="/register">إنشاء حساب</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/login?next=/forum">دخول</Link>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <p className="mt-3 px-1 text-xs text-muted-foreground">احترم الآخرين، ولا تنشر أرقام هاتف أو معلومات شخصية. المشرف يخفي ما يخالف ذلك.</p>
        </aside>
      </div>
    </div>
  )
}
