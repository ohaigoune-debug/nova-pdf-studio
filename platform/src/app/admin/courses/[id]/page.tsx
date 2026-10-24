import { BookOpen, ExternalLink, KeyRound, Package, Radio, Users } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LinkProductForm, ManualEnrollDialog, RevokeEnrollmentButton, UnlinkProductButton } from '@/components/courses/course-admin'
import { CourseForm } from '@/components/courses/course-form'
import { CourseBookCard } from '@/components/courses/course-book-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, EmptyState, PageHeader, StatCard } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import type { CourseStatus, EnrollmentSource } from '@/server/db/schema/enums'
import { isAppError } from '@/server/lib/errors'
import { bankFormOptions } from '@/server/queries/bank-options'
import { BOOK_ISSUE_AR, courseBookState } from '@/server/services/course-purchase.service'
import { COURSE_STATUS_AR, ENROLLMENT_SOURCE_AR, ENROLLMENT_STATUS_AR, getCourseAdmin, listCourseWorkspaces, listLinkableProducts } from '@/server/services/courses.service'

export const dynamic = 'force-dynamic'

const STATUS_VARIANT: Record<string, 'secondary' | 'success' | 'muted'> = { DRAFT: 'secondary', PUBLISHED: 'success', ARCHIVED: 'muted' }
const ENROLL_VARIANT: Record<string, 'success' | 'muted' | 'destructive'> = { ACTIVE: 'success', EXPIRED: 'muted', REVOKED: 'destructive' }

export default async function AdminCourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const db = await getDb()
  let data: Awaited<ReturnType<typeof getCourseAdmin>>
  try {
    data = await getCourseAdmin(db, actor, id)
  } catch (err) {
    if (isAppError(err) && err.code === 'COURSE_NOT_FOUND') notFound()
    throw err
  }
  const [opts, workspaces, linkable] = await Promise.all([bankFormOptions(db, actor), listCourseWorkspaces(db, actor), listLinkableProducts(db, actor)])
  const { course, enrollments, products, upcomingSessions, counts } = data
  const bookState = await courseBookState(db, course)
  const candidates = bookState.book ? [] : products.filter((p) => p.status === 'PUBLISHED').map((p) => ({ id: p.productId, title: p.title, priceDzd: p.priceDzd }))
  const linkedIds = new Set(products.map((p) => p.productId))
  const activeCount = enrollments.filter((e) => e.status === 'ACTIVE').length

  return (
    <div className="space-y-6">
      <PageHeader
        title={course.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[course.status] ?? 'secondary'}>{COURSE_STATUS_AR[course.status as CourseStatus]}</Badge>
            <span>
              {data.teacherName} · {course.season}
              {data.levelName ? ` · ${data.levelName}` : ''}
              {data.subjectName ? ` · ${data.subjectName}` : ''}
              {data.streamNames.length ? ` · ${data.streamNames.join('، ')}` : ''}
            </span>
          </span>
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/courses">كل الدورات</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/courses/codes?course=${course.id}`}>
                <KeyRound className="size-4" /> أكواد التفعيل
              </Link>
            </Button>
            <ManualEnrollDialog courseId={course.id} defaultExpiresOn={course.accessEndsOn} />
          </>
        }
      />

      <CourseBookCard courseId={course.id} courseTitle={course.title} book={bookState.book} purchasable={bookState.purchasable} issueText={bookState.issue ? BOOK_ISSUE_AR[bookState.issue] : null} candidates={candidates} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="اشتراكات نشطة" value={counts.activeEnrollments} hint={`${enrollments.length} إجمالاً`} icon={Users} tone="success" />
        <StatCard label="منتجات مرتبطة" value={counts.productsCount} icon={Package} />
        <StatCard label="حصص قادمة" value={counts.upcomingSessions} icon={Radio} />
        <StatCard label="ينتهي الوصول" value={course.accessEndsOn ? formatDate(course.accessEndsOn) : '—'} icon={BookOpen} />
      </div>

      <Alert tone="info" title="انشر الدروس من صفحة الفوج">
        <p>
          محتوى الدورة (فيديوهات، ملفات، دروس) يُنشر كما يُنشر لأي فوج: من{' '}
          <Link href="/admin/publish" className="font-semibold text-primary hover:underline">
            صفحة النشر
          </Link>{' '}
          أو{' '}
          <Link href="/admin/content" className="font-semibold text-primary hover:underline">
            المحتوى
          </Link>{' '}
          مع استهداف فوج «{course.title}» (الظهور: الفوج فقط). المشتركون النشطون أعضاء في هذا الفوج تلقائياً.
        </p>
      </Alert>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>المشتركون</CardTitle>
            <CardDescription>{activeCount} نشط من {enrollments.length}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {enrollments.length === 0 ? (
            <EmptyState icon={Users} title="لا مشتركين بعد" description="يُفعَّل الاشتراك تلقائياً عند تسليم الكتاب المرتبط، أو يدوياً من زر «تفعيل يدوي»." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التلميذ</TableHead>
                  <TableHead>المصدر</TableHead>
                  <TableHead>فُعّل في</TableHead>
                  <TableHead>ينتهي في</TableHead>
                  <TableHead>الشروط</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <span className="font-semibold">{e.fullName || '—'}</span>
                      <span className="block text-xs text-muted-foreground" dir="ltr">
                        {e.email}
                        {e.phone ? ` · ${e.phone}` : ''}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{ENROLLMENT_SOURCE_AR[e.source as EnrollmentSource] ?? e.source}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(e.activatedAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.expiresAt ? formatDate(e.expiresAt) : 'بلا حدّ'}</TableCell>
                    <TableCell className="text-xs">{e.acceptedTermsAt ? <Badge variant="success">قُبلت</Badge> : <Badge variant="secondary">بعدُ</Badge>}</TableCell>
                    <TableCell>
                      <Badge variant={ENROLL_VARIANT[e.status] ?? 'secondary'}>{ENROLLMENT_STATUS_AR[e.status] ?? e.status}</Badge>
                      {e.revokedReason ? <span className="block text-[11px] text-muted-foreground">{e.revokedReason}</span> : null}
                    </TableCell>
                    <TableCell>{e.status === 'ACTIVE' ? <RevokeEnrollmentButton courseId={course.id} enrollmentId={e.id} /> : null}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>المنتجات المرتبطة</CardTitle>
            <CardDescription>سعر الدورة = سعر الكتاب المرتبط. تسليم طلب يحوي أحد هذه المنتجات يفعّل الاشتراك تلقائياً؛ وإن لم يُفعَّل: «تفعيل يدوي» هنا، أو «أكواد التفعيل» لهذه الدورة، أو «كود تفعيل» على الطلب في المتجر.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا منتج مرتبط بعد.</p>
            ) : (
              <ul className="divide-y rounded-lg border text-sm">
                {products.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 p-2.5">
                    <span>
                      <Link href={`/admin/store/products/${p.productId}`} className="font-semibold hover:underline">
                        {p.title}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {p.priceDzd} دج · {p.status === 'PUBLISHED' ? 'منشور' : p.status === 'ARCHIVED' ? 'مؤرشف' : 'مسودة'}
                      </span>
                    </span>
                    <UnlinkProductButton courseId={course.id} productId={p.productId} />
                  </li>
                ))}
              </ul>
            )}
            <LinkProductForm courseId={course.id} options={linkable.filter((p) => !linkedIds.has(p.id))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>الحصص المباشرة القادمة</CardTitle>
            <CardDescription>تُدار من صفحة البث المباشر؛ هنا للعرض فقط.</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا حصص مجدولة.</p>
            ) : (
              <ul className="divide-y rounded-lg border text-sm">
                {upcomingSessions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 p-2.5">
                    <span>
                      <span className="block font-semibold">{s.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDateTime(s.startsAt)} · {s.durationMinutes} د · {s.provider}
                      </span>
                    </span>
                    <Radio className="size-4 text-muted-foreground" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>بيانات الدورة</CardTitle>
            <CardDescription>
              الرابط للتلاميذ: <span dir="ltr">/student/courses/{course.slug}</span> · نسخة الشروط: {course.termsVersion}
            </CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/groups">
              <ExternalLink className="size-4" /> الأفواج
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="max-w-3xl">
            <CourseForm course={course} options={{ workspaces, subjects: opts.subjects, levels: opts.levels, streams: opts.streams }} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
