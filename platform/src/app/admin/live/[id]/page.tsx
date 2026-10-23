import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AttachRecordingForm, LiveStatusButtons } from '@/components/live/live-admin-actions'
import { LiveSessionForm } from '@/components/live/live-form'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { eq, inArray } from 'drizzle-orm'
import { profiles, students } from '@/server/db/schema'
import type { LiveSessionStatus } from '@/server/db/schema/enums'
import { isAppError } from '@/server/lib/errors'
import { LIVE_STATUS_AR, coursesForLiveForm, getLiveAdmin, joinWindow, liveAttendance, recordingCandidates } from '@/server/services/live.service'

export const dynamic = 'force-dynamic'

export default async function LiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const { id } = await params
  const db = await getDb()
  let s
  try {
    s = await getLiveAdmin(db, actor, id)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const [courses, candidates, attendance] = await Promise.all([coursesForLiveForm(db, actor), recordingCandidates(db, actor, s.courseId), liveAttendance(db, actor, s.id)])
  const names = attendance.length
    ? await db
        .select({ studentId: students.id, name: profiles.fullName })
        .from(students)
        .innerJoin(profiles, eq(profiles.userId, students.userId))
        .where(inArray(students.id, attendance.map((a) => a.studentId)))
    : []
  const nameOf = new Map<string, string | null>()
  for (const n of names) nameOf.set(n.studentId, n.name)
  const w = joinWindow(s.startsAt, s.durationMinutes)
  return (
    <div className="space-y-6">
      <Link href="/admin/live" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> البث المباشر
      </Link>
      <PageHeader
        title={s.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge>{LIVE_STATUS_AR[s.status as LiveSessionStatus]}</Badge>
            <span>{s.courseTitle}</span>
            <span dir="ltr">· {formatDateTime(s.startsAt)}</span>
            <span className="text-xs">نافذة الانضمام: {formatDateTime(w.opensAt)} → {formatDateTime(w.closesAt)}</span>
          </span>
        }
        actions={<LiveStatusButtons id={s.id} status={s.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>تعديل الحصة</CardTitle>
          </CardHeader>
          <CardContent>
            <LiveSessionForm id={s.id} defaults={{ ...s, joinUrl: '', hasJoinUrl: !!s.joinUrl }} courses={courses} />
            {s.joinUrl ? (
              <p className="mt-3 text-xs text-muted-foreground">
                الرابط المحفوظ:{' '}
                <code dir="ltr" className="break-all">
                  {s.joinUrl}
                </code>
              </p>
            ) : null}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>التسجيل</CardTitle>
            </CardHeader>
            <CardContent>
              <AttachRecordingForm id={s.id} current={s.recordingContentId} candidates={candidates} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>حضور البث ({attendance.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {attendance.length === 0 ? (
                <p className="text-sm text-muted-foreground">لم ينضم أحد بعد.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>التلميذ</TableHead>
                      <TableHead>أول انضمام</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((a) => (
                      <TableRow key={a.studentId}>
                        <TableCell>{nameOf.get(a.studentId) ?? a.studentId.slice(0, 8)}</TableCell>
                        <TableCell className="text-xs">{formatDateTime(a.at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
