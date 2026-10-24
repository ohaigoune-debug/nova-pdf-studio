import { BookOpen, FileUp, MessageSquare, MessagesSquare, PlayCircle, Upload, Users, Wallet, Wrench } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { pendingCommentsCount } from '@/server/services/lesson-extras.service'
import { teacherHome } from '@/server/services/teacher-home.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'لوحتي' }

const dzd = (n: number) => `${n.toLocaleString('ar-DZ')} دج`

/** نشر المحتوى — نفس مداخل القائمة الجانبية */
const ACTIONS = [
  { href: '/teacher/publish?type=LESSON', label: 'رفع ملفات', hint: 'دروس، ملخّصات، تمارين (PDF/Word)', icon: Upload },
  { href: '/teacher/publish?type=TEST', label: 'رفع اختبار', hint: 'فرض أو اختبار مع حلّه', icon: FileUp },
  { href: '/teacher/content', label: 'المحتوى والحصص السابقة', hint: 'كل ما نشرتَه وتسجيلات الحصص', icon: BookOpen }
] as const

/**
 * /teacher — الواجهة المبسّطة (قرار المالك 2026-10-23): المسجّلون في الدورة، المداخيل،
 * رفع ملفات، رفع اختبار، المحتوى والحصص السابقة، القسم الافتراضي. بقية الأدوات في /teacher/tools.
 */
export default async function TeacherHomePage() {
  const actor = await requirePageActor('TEACHER')
  const db = await getDb()
  const [h, pendingComments] = await Promise.all([teacherHome(db, actor), pendingCommentsCount(db, actor)])
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">مرحباً، {actor.fullName}</h1>
        <p className="text-sm text-muted-foreground">دوراتك ومداخيلك في لمحة، وما تحتاجه للتدريس في نقرة.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-5 text-primary" /> المسجّلون في دوراتك
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-4xl font-extrabold tabular-nums">{h.enrolledActive}</p>
            <p className="text-xs text-muted-foreground">اشتراك نشط الآن · {h.enrolledTotal} اشتراكاً منذ البداية</p>
            {h.courses.length ? (
              <ul className="divide-y rounded-lg border text-sm">
                {h.courses.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 p-2.5">
                    <span className="min-w-0 truncate font-semibold">{c.title}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {c.status !== 'PUBLISHED' ? <Badge variant="muted">{c.status === 'DRAFT' ? 'مسودة' : 'مؤرشفة'}</Badge> : null}
                      <Badge>{c.active} نشط</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">لا دورات باسمك بعد — تُنشأ من الإدارة.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-5 text-primary" /> مداخيلك
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-4xl font-extrabold tabular-nums">{dzd(h.income.deliveredDzd)}</p>
            <p className="text-xs text-muted-foreground">مبيعات الكتب المرتبطة بدوراتك — {h.income.deliveredOrders} طلباً سُلِّم (إجمالي قبل أي اقتطاع)</p>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border p-2.5">
                <dt className="text-xs text-muted-foreground">قيد التوصيل</dt>
                <dd className="font-bold tabular-nums">{dzd(h.income.pendingDzd)}</dd>
              </div>
              <div className="rounded-lg border p-2.5">
                <dt className="text-xs text-muted-foreground">سوق الأساتذة — رصيدك</dt>
                <dd className="font-bold tabular-nums">{dzd(h.income.marketBalanceDzd)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-lg font-extrabold">نشر المحتوى</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ACTIONS.map((a) => (
          <Link key={a.href} href={a.href} className="group">
            <Card className="h-full transition-colors group-hover:border-primary/50">
              <CardContent className="flex flex-col items-center gap-2 p-5 text-center">
                <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <a.icon className="size-6" />
                </span>
                <span className="font-bold">{a.label}</span>
                <span className="text-xs text-muted-foreground">{a.hint}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <h2 className="text-lg font-extrabold">التفاعل</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href="/teacher/classroom" className="group">
          <Card className="h-full transition-colors group-hover:border-primary/50">
            <CardContent className="flex items-center gap-3 p-5">
              <MessagesSquare className="size-8 shrink-0 text-primary" />
              <span>
                <span className="block font-bold">القسم الافتراضي</span>
                <span className="block text-xs text-muted-foreground">منشوراتك وأسئلة تلاميذك</span>
              </span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/teacher/comments" className="group">
          <Card className={`h-full transition-colors group-hover:border-primary/50 ${pendingComments ? 'border-warning/60' : ''}`}>
            <CardContent className="flex items-center gap-3 p-5">
              <MessageSquare className="size-8 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block font-bold">تعليقات الحصص</span>
                <span className="block text-xs text-muted-foreground">لا يظهر تعليق قبل موافقتك</span>
              </span>
              {pendingComments ? <Badge variant="warning">{pendingComments} بانتظارك</Badge> : null}
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <PlayCircle className="size-5 text-primary" /> الحصص السابقة
          </CardTitle>
        </CardHeader>
        <CardContent>
          {h.pastSessions.length ? (
            <ul className="divide-y rounded-lg border text-sm">
              {h.pastSessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 p-2.5">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{s.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {s.courseTitle} · {formatDateTime(s.startsAt)}
                    </span>
                  </span>
                  {s.recordingSlug ? (
                    <Link href={`/teacher/content?q=${encodeURIComponent(s.title)}`} className="shrink-0 text-xs font-semibold text-primary hover:underline">
                      التسجيل
                    </Link>
                  ) : (
                    <Badge variant="muted">بلا تسجيل</Badge>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">لا حصص سابقة بعد. تسجيلات الحصص ودروسك كلها في «المحتوى والحصص السابقة».</p>
          )}
        </CardContent>
      </Card>

      <Link href="/teacher/tools" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <Wrench className="size-3.5" /> أدوات أخرى (اختبارات QCM، بنك الأسئلة، الملفات…)
      </Link>
    </div>
  )
}
