'use client'

import { Archive, Eye, EyeOff, Link2, Search, UserPlus, UserX, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import {
  enrollStudentAction,
  linkCourseProductAction,
  revokeEnrollmentAction,
  searchStudentsAction,
  setCourseStatusAction,
  unlinkCourseProductAction
} from '@/server/actions/courses.actions'

type Result = { ok: boolean; error?: { message: string } }

function useRun() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<Result>, ok: string, after?: () => void) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) return toast('error', r.error!.message)
      toast('success', ok)
      after?.()
      router.refresh()
    })
  return { pending, run }
}

export function CourseStatusActions({ id, status }: { id: string; status: string }) {
  const { pending, run } = useRun()
  return (
    <div className="flex justify-end gap-1">
      {status === 'PUBLISHED' ? (
        <Button size="sm" variant="ghost" title="إخفاء (مسودة)" loading={pending} onClick={() => run(() => setCourseStatusAction(id, 'DRAFT'), 'أُخفيت الدورة')}>
          <EyeOff className="size-4" />
        </Button>
      ) : (
        <Button size="sm" variant="ghost" title="نشر" loading={pending} onClick={() => run(() => setCourseStatusAction(id, 'PUBLISHED'), 'نُشرت الدورة')}>
          <Eye className="size-4" />
        </Button>
      )}
      {status !== 'ARCHIVED' ? (
        <Button size="sm" variant="ghost" title="أرشفة" loading={pending} onClick={() => confirm('أرشفة الدورة؟ الاشتراكات الحالية تبقى كما هي.') && run(() => setCourseStatusAction(id, 'ARCHIVED'), 'أُرشفت')}>
          <Archive className="size-4" />
        </Button>
      ) : null}
    </div>
  )
}

/** ربط منتج من المتجر (كتاب) بالدورة: شراؤه يفعّل الاشتراك */
export function LinkProductForm({ courseId, options }: { courseId: string; options: { id: string; title: string; type: string; priceDzd: number }[] }) {
  const { pending, run } = useRun()
  const [productId, setProductId] = useState('')
  if (options.length === 0) return <p className="text-sm text-muted-foreground">لا منتجات متاحة للربط. أنشئ منتجاً في المتجر أولاً.</p>
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Field label="منتج من المتجر" htmlFor="link-product" className="flex-1">
        <Select id="link-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">اختر…</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} · {p.priceDzd} دج
            </option>
          ))}
        </Select>
      </Field>
      <Button type="button" disabled={!productId} loading={pending} onClick={() => run(() => linkCourseProductAction(courseId, productId), 'رُبط المنتج بالدورة', () => setProductId(''))}>
        <Link2 className="size-4" /> ربط
      </Button>
    </div>
  )
}

export function UnlinkProductButton({ courseId, productId }: { courseId: string; productId: string }) {
  const { pending, run } = useRun()
  return (
    <Button size="sm" variant="ghost" title="فكّ الربط" loading={pending} onClick={() => confirm('فكّ ربط المنتج بالدورة؟') && run(() => unlinkCourseProductAction(courseId, productId), 'فُكّ الربط')}>
      <X className="size-4" />
    </Button>
  )
}

type StudentHit = { studentId: string; fullName: string | null; email: string; phone: string | null }

/** تفعيل يدوي: بحث عن التلميذ ثم تفعيل مع تاريخ انتهاء اختياري */
export function ManualEnrollDialog({ courseId, defaultExpiresOn }: { courseId: string; defaultExpiresOn: string | null }) {
  const { pending, run } = useRun()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<StudentHit[]>([])
  const [searching, startSearch] = useTransition()
  const [chosen, setChosen] = useState<StudentHit | null>(null)
  const [source, setSource] = useState<'MANUAL' | 'GIFT'>('MANUAL')
  const [expiresOn, setExpiresOn] = useState(defaultExpiresOn ?? '')

  const search = () =>
    startSearch(async () => {
      const r = await searchStudentsAction(q)
      if (!r.ok) return toast('error', r.error.message)
      setHits(r.data)
      if (r.data.length === 0) toast('info', 'لا نتائج')
    })

  const reset = () => {
    setQ('')
    setHits([])
    setChosen(null)
    setSource('MANUAL')
    setExpiresOn(defaultExpiresOn ?? '')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" /> تفعيل يدوي
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تفعيل اشتراك تلميذ</DialogTitle>
          <DialogDescription>ابحث بالبريد أو الهاتف أو الاسم. التفعيل يضيف التلميذ إلى فوج الدورة فوراً ويُشعره.</DialogDescription>
        </DialogHeader>
        {!chosen ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (q.trim().length >= 2) search()
                  }
                }}
                placeholder="بريد، هاتف 05/06/07…، أو اسم"
                dir="auto"
                autoFocus
              />
              <Button type="button" variant="outline" loading={searching} disabled={q.trim().length < 2} onClick={search}>
                <Search className="size-4" />
              </Button>
            </div>
            {hits.length > 0 ? (
              <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border text-sm">
                {hits.map((h) => (
                  <li key={h.studentId}>
                    <button type="button" className="flex w-full items-center justify-between gap-2 p-2.5 text-start hover:bg-muted" onClick={() => setChosen(h)}>
                      <span>
                        <span className="block font-semibold">{h.fullName || '—'}</span>
                        <span className="block text-xs text-muted-foreground" dir="ltr">
                          {h.email}
                          {h.phone ? ` · ${h.phone}` : ''}
                        </span>
                      </span>
                      <UserPlus className="size-4 text-primary" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="font-semibold">{chosen.fullName || '—'}</p>
              <p className="text-xs text-muted-foreground" dir="ltr">
                {chosen.email}
                {chosen.phone ? ` · ${chosen.phone}` : ''}
              </p>
              <button type="button" className="mt-1 text-xs text-primary hover:underline" onClick={() => setChosen(null)}>
                اختيار تلميذ آخر
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="نوع التفعيل" htmlFor="enroll-source">
                <Select id="enroll-source" value={source} onChange={(e) => setSource(e.target.value as 'MANUAL' | 'GIFT')}>
                  <option value="MANUAL">تفعيل يدوي (دفع خارج المنصة)</option>
                  <option value="GIFT">هدية / مجاني</option>
                </Select>
              </Field>
              <Field label="ينتهي في" htmlFor="enroll-expires" hint="فارغ = حتى آخر يوم للوصول في الدورة">
                <Input id="enroll-expires" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} dir="ltr" />
              </Field>
            </div>
            <Button
              type="button"
              className="w-full"
              loading={pending}
              onClick={() =>
                run(() => enrollStudentAction({ courseId, studentId: chosen.studentId, source, expiresOn: expiresOn || null }), 'فُعّل الاشتراك', () => setOpen(false))
              }
            >
              <UserPlus className="size-4" /> تفعيل الاشتراك
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function RevokeEnrollmentButton({ courseId, enrollmentId }: { courseId: string; enrollmentId: string }) {
  const { pending, run } = useRun()
  return (
    <Button
      size="sm"
      variant="ghost"
      title="إلغاء الاشتراك"
      loading={pending}
      onClick={() => {
        const reason = prompt('سبب الإلغاء (يصل إلى التلميذ):')
        if (reason === null) return
        run(() => revokeEnrollmentAction({ courseId, enrollmentId, reason }), 'أُلغي الاشتراك')
      }}
    >
      <UserX className="size-4 text-destructive" />
    </Button>
  )
}
