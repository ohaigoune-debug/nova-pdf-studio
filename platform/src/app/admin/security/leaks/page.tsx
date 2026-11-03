import { MonitorSmartphone, PlayCircle, ScanSearch, ShieldAlert, UserRound } from 'lucide-react'
import { UserStatusButton } from '@/components/domain/user-status-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { errorMessage } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { LEAK_SEARCH_LIMIT, parseLeakQuery, traceLeak } from '@/server/services/leak-trace.service'

export const metadata = { title: 'كشف التسريب' }

const KIND_LABEL = { code: 'رمز الحساب', phone: 'آخر 4 أرقام الهاتف', email: 'البريد', name: 'الاسم' } as const

function minutes(seconds: number): string {
  return seconds >= 60 ? `${Math.round(seconds / 60)} د` : `${seconds} ث`
}

export default async function LeakTracePage({ searchParams }: { searchParams: Promise<{ q?: string; date?: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const { q = '', date = '' } = await searchParams
  let result: Awaited<ReturnType<typeof traceLeak>> | null = null
  let error: string | null = null
  if (q.trim()) {
    try {
      result = await traceLeak(await getDb(), actor, parseLeakQuery(q, date || null))
    } catch (e) {
      if (!isAppError(e)) throw e
      error = e.code === 'VALIDATION' ? 'لم أفهم البحث. الصق رمز الحساب (8 خانات) أو آخر 4 أرقام الهاتف أو البريد أو الاسم، والتاريخ إن ظهر.' : errorMessage(e.code)
    }
  }
  return (
    <>
      <PageHeader
        title="كشف التسريب"
        description="الصق ما يظهر في الفيديو أو الملف المسرَّب: رمز الحساب (8 خانات بجانب التاريخ)، أو آخر 4 أرقام الهاتف، أو البريد، أو الاسم. أضف التاريخ الظاهر ليُقدَّم من شاهد في ذلك اليوم."
      />
      <Card className="mb-6">
        <CardContent className="pt-6">
          <form method="get" className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
            <Input name="q" defaultValue={q} placeholder="مثال: 2026-11-03 · 4b21efbc" aria-label="ما يظهر في العلامة المائية" dir="auto" required />
            <Input name="date" type="date" defaultValue={date} aria-label="تاريخ المشاهدة" />
            <Button type="submit">
              <ScanSearch className="size-4" /> كشف
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            كل بحث يُسجَّل في سجل التدقيق. الأرقام هنا قرائن تحتاج تأكيدًا قبل أي إجراء قانوني: احفظ صور المنشور المسرَّب وروابطه وتاريخه.
          </p>
        </CardContent>
      </Card>

      {error ? <p className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p> : null}

      {result ? (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            البحث بـ{KIND_LABEL[result.query.kind]} «{result.query.value}»{result.query.date ? ` في ${result.query.date}` : ''}: {result.matches.length} حساب
            {result.truncated ? ` (أول ${LEAK_SEARCH_LIMIT} فقط — أضف التاريخ لتضييق النتائج)` : ''}.
          </p>
          {result.matches.length === 0 ? <EmptyState icon={ShieldAlert} title="لا حساب يطابق هذه القرينة" description="تأكد من الرمز (8 خانات بالأرقام والحروف اللاتينية a–f) أو جرّب آخر 4 أرقام الهاتف مع التاريخ." /> : null}
          <div className="space-y-4">
            {result.matches.map((m) => (
              <Card key={m.userId} data-testid="leak-match">
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <UserRound className="size-5" /> {m.fullName || '—'}
                    </CardTitle>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <Badge variant="outline" dir="ltr">
                        {m.code}
                      </Badge>
                      <span dir="ltr">{m.email}</span>
                      {m.phone ? <span dir="ltr">{m.phone}</span> : null}
                      {result.query.date ? m.viewedOnDate ? <Badge variant="destructive">شاهد في {result.query.date}</Badge> : <Badge variant="muted">لم يشاهد في ذلك اليوم</Badge> : null}
                      <Badge variant={m.status === 'ACTIVE' ? 'success' : 'muted'}>{m.status === 'ACTIVE' ? 'نشط' : 'موقوف'}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      أنشئ {formatDateTime(m.createdAt)} · آخر دخول {m.lastLoginAt ? formatDateTime(m.lastLoginAt) : '—'}
                    </p>
                  </div>
                  {m.role === 'STUDENT' ? <UserStatusButton userId={m.userId} status={m.status} /> : <Badge variant="secondary">{m.role}</Badge>}
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {m.courses.length ? (
                    <div className="flex flex-wrap gap-2">
                      {m.courses.map((c, i) => (
                        <Badge key={i} variant={c.active ? 'default' : 'muted'}>
                          {c.title}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <div>
                    <h3 className="mb-2 flex items-center gap-1.5 font-bold">
                      <PlayCircle className="size-4" /> {result.query.date ? `مشاهدات ${result.query.date}` : 'آخر المشاهدات'}
                    </h3>
                    {m.views.length === 0 ? (
                      <p className="text-muted-foreground">لا مشاهدات مسجّلة.</p>
                    ) : (
                      <ul className="divide-y rounded-lg border">
                        {m.views.map((v, i) => (
                          <li key={i} className="flex flex-wrap justify-between gap-2 p-2.5">
                            <span className="font-medium">{v.contentTitle}</span>
                            <span className="text-xs text-muted-foreground" dir="ltr">
                              {formatDateTime(v.startedAt)} → {formatDateTime(v.lastSeenAt)} · {minutes(v.secondsWatched)} · {v.device} · {v.ip ?? '—'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {m.devices.length ? (
                    <div>
                      <h3 className="mb-2 flex items-center gap-1.5 font-bold">
                        <MonitorSmartphone className="size-4" /> الأجهزة والجلسات
                      </h3>
                      <ul className="flex flex-wrap gap-2 text-xs">
                        {m.devices.map((d, i) => (
                          <li key={i} className="rounded-md border px-2 py-1" dir="auto">
                            {d.deviceName ?? 'جهاز'} · {d.ip ?? '—'} · {formatDateTime(d.lastSeenAt)} {d.active ? '· نشطة' : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </>
  )
}
