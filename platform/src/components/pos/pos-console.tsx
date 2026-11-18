'use client'

import { CheckCircle2, Copy, MessageCircle, PackagePlus, Printer, Send, Undo2, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { formatDateTime } from '@/lib/utils'
import { cancelPosCodeAction, confirmPosSaleAction, generatePosCodeAction, pickPosSaleStudentAction, requestRestockAction, startPosSaleAction, undoPosActivationAction } from '@/server/actions/pos.actions'
import type { PosSaleResult, PosSaleStudent } from '@/server/services/points-of-sale.service'

export interface PosConsoleCode {
  id: string
  code: string | null
  courseTitle: string
  status: 'ACTIVE' | 'USED' | 'CANCELLED'
  priceDzd: number | null
  createdAt: string
  usedAt: string | null
  soldBy: string | null
  cancellable: boolean
  soldVia: 'CODE' | 'SMS' | null
  soldPhoneMasked: string | null
  studentName: string | null
  undoable: boolean
}

interface StockLine {
  courseId: string
  courseTitle: string
  sent: number
  sold: number
  remaining: number
  priceDzd: number
}

/** الكود كما يُقرأ ويُملى: 3-4-4 */
const fmt = (code: string) => `${code.slice(0, 3)} ${code.slice(3, 7)} ${code.slice(7)}`
const shareText = (code: string, title: string) => `كود تفعيل «${title}» في منصة مدرسة: ${fmt(code)}\nادخل حسابك ثم افتح madrasadz.com/claim واكتب الكود. يُستعمل مرة واحدة.`
const waLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`
const digits = (v: string) => v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/\D/g, '')
const studentLine = (s: PosSaleStudent) => [s.levelName, s.streamName, s.wilayaName].filter(Boolean).join(' · ')

function statusOf(c: PosConsoleCode): { label: string; variant: 'success' | 'warning' | 'muted' | 'secondary' } {
  if (c.status === 'CANCELLED') return { label: c.soldVia === 'SMS' && c.usedAt ? 'تُراجِع عنه' : 'أُلغي', variant: 'muted' }
  if (c.status === 'USED') return { label: 'فُعّلت', variant: 'success' }
  if (c.soldVia === 'SMS' && c.soldPhoneMasked) return { label: 'محجوزة لرقمه', variant: 'secondary' }
  return { label: c.soldVia === 'CODE' ? 'كود احتياطي — لم يُستعمل' : 'لم يُفعَّل بعد', variant: 'warning' }
}

type Step = { line: StockLine; phone: string; phoneMasked: string | null; code: string; sentAt: number | null }

/**
 * واجهة نقطة البيع (18 نوفمبر 2026): لكل دورة خانة هاتف التلميذ ← «أرسل رمز التفعيل» ← الرمز الذي قرأه التلميذ ←
 * تفعيل فوري مع اسمه ولقبه (أو حجز لرقمه إن لم يكن له حساب، أو اختيار من أبناء الرقم نفسه).
 * الكود الاحتياطي (يُكتب في /claim) يبقى لمن ليس معه هاتفه. لا بيع ولا عدّاد قبل تأكيد الرمز.
 */
export function PosConsole({ pos, summary, codes }: { pos: { id: string; name: string; status: string; commissionDzd: number }; summary: { stock: StockLine[]; soldCount: number; activatedCount: number; commissionDzd: number; owedDzd: number }; codes: PosConsoleCode[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [phones, setPhones] = useState<Record<string, string>>({})
  const [step, setStep] = useState<Step | null>(null)
  const [result, setResult] = useState<(PosSaleResult & { courseTitle: string }) | null>(null)
  const [backup, setBackup] = useState<{ code: string; title: string; remaining: number } | null>(null)
  const [restock, setRestock] = useState({ open: false, qty: '', note: '' })
  const [now, setNow] = useState(() => Date.now())
  const open = pos.status === 'ACTIVE'

  useEffect(() => {
    if (!step?.sentAt) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [step?.sentAt])
  const resendIn = step?.sentAt ? Math.max(0, 60 - Math.floor((now - step.sentAt) / 1000)) : 0

  const reset = () => {
    setStep(null)
    setResult(null)
    setBackup(null)
  }

  const send = (line: StockLine, phone: string) =>
    start(async () => {
      const r = await startPosSaleAction({ courseId: line.courseId, phone: digits(phone) })
      if (!r.ok) return toast('error', r.error.message)
      setResult(null)
      setBackup(null)
      setStep({ line, phone: digits(phone), phoneMasked: r.data.phoneMasked, code: '', sentAt: Date.now() })
      setNow(Date.now())
    })

  const confirm = () =>
    start(async () => {
      if (!step) return
      const r = await confirmPosSaleAction({ courseId: step.line.courseId, phone: step.phone, code: digits(step.code) })
      if (!r.ok) return toast('error', r.error.message)
      setResult(r.data)
      // الرمز استُهلك: تختفي خانته في كل الحالات (والاختيار بين الأبناء يظهر في بطاقته)
      setStep(null)
      setPhones((p) => ({ ...p, [step.line.courseId]: '' }))
      router.refresh()
    })

  const pick = (ticket: string, studentId: string) =>
    start(async () => {
      const r = await pickPosSaleStudentAction({ ticket, studentId })
      if (!r.ok) return toast('error', r.error.message)
      setResult(r.data)
      setStep(null)
      router.refresh()
    })

  const backupCode = (line: StockLine) =>
    start(async () => {
      if (!window.confirm(`كود احتياطي لـ«${line.courseTitle}» (${line.priceDzd} دج)؟\nيُسجَّل البيع على حسابك، ويكتبه التلميذ في madrasadz.com/claim.`)) return
      const r = await generatePosCodeAction(line.courseId)
      if (!r.ok) return toast('error', r.error.message)
      setStep(null)
      setResult(null)
      setBackup({ code: r.data.code, title: r.data.courseTitle, remaining: r.data.remaining })
      router.refresh()
    })

  const undo = (codeId: string) =>
    start(async () => {
      if (!window.confirm('تراجع عن هذا التفعيل؟ تُلغى الدورة من حساب التلميذ وتعود الباقة إلى عدّادك. استعمله فقط إن فُعّلت لتلميذ خطأ.')) return
      const r = await undoPosActivationAction(codeId)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'أُلغي التفعيل وعادت الباقة إلى عدّادك')
      setResult(null)
      router.refresh()
    })

  const cancel = (c: PosConsoleCode) =>
    start(async () => {
      if (!window.confirm(`إلغاء ${c.code ? `الكود ${fmt(c.code)}` : 'هذا البيع'}؟ استعمله فقط إن أُرجعت الباقة ولم يُفعَّل.`)) return
      const r = await cancelPosCodeAction(c.id)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'أُلغي وعادت الباقة إلى عدّادك')
      if (backup && c.code === backup.code) setBackup(null)
      router.refresh()
    })

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      toast('success', 'نُسخ الكود')
    } catch {
      toast('error', 'تعذّر النسخ — اكتبه يدويًّا')
    }
  }

  const sendRestock = () =>
    start(async () => {
      const qty = Number(restock.qty)
      const r = await requestRestockAction({ courseId: summary.stock[0]?.courseId ?? null, qty: Number.isInteger(qty) && qty > 0 ? qty : null, note: restock.note || null })
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'أُرسل طلبك إلى إدارة المنصة')
      setRestock({ open: false, qty: '', note: '' })
    })

  const lastActivatedId = result?.kind === 'ACTIVATED' ? result.codeId : null
  const lastUndoable = lastActivatedId ? codes.find((c) => c.id === lastActivatedId)?.undoable ?? true : false

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <h1 className="text-xl font-bold">{pos.name}</h1>
        <p className="text-sm text-muted-foreground">عند كل بيع: اكتب هاتف التلميذ، واطلب منه الرمز الذي يصله في رسالة، فتُفعَّل دورته فورًا.</p>
      </div>

      {!open ? <Alert tone="warning" title="البيع مغلق حاليًا">تواصل مع إدارة المنصة.</Alert> : null}

      {/* ───── نتيجة البيع ───── */}
      {result?.kind === 'ACTIVATED' ? (
        <Card className="border-success/50 print:hidden">
          <CardContent className="space-y-3 pt-6 text-center">
            <CheckCircle2 className="mx-auto size-14 text-success" aria-hidden />
            <p className="text-xl font-extrabold">فُعّلت الدورة</p>
            <p className="text-sm text-muted-foreground">الدورة الآن في حساب التلميذ، ويصله إشعار.</p>
            <dl className="divide-y text-start text-sm">
              {[
                ['التلميذ', result.student.fullName],
                ['المستوى', [result.student.levelName, result.student.streamName].filter(Boolean).join(' — ') || '—'],
                ['الولاية', result.student.wilayaName ?? '—'],
                ['الدورة', result.courseTitle],
                ['باقي عندك', String(result.remaining)]
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 py-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-bold">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="grid gap-2">
              <Button size="lg" onClick={reset}>
                بيع جديد
              </Button>
              {lastUndoable ? (
                <Button variant="outline" loading={pending} onClick={() => undo(result.codeId)}>
                  <Undo2 className="size-4" /> تراجع — أخطأتُ التلميذ
                </Button>
              ) : null}
              <p className="text-xs text-muted-foreground">التراجع متاح لك 24 ساعة من سجل مبيعاتك، وبعدها عن طريق الإدارة.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {result?.kind === 'RESERVED' ? (
        <Card className="border-primary/40 print:hidden">
          <CardContent className="space-y-3 pt-6 text-center">
            <CheckCircle2 className="mx-auto size-14 text-primary" aria-hidden />
            <p className="text-xl font-extrabold">الرقم مؤكَّد — والدورة محجوزة له</p>
            <p className="text-sm text-muted-foreground">
              لا حساب بهذا الرقم بعد. حين يسجّل التلميذ في المنصة بالرقم <span dir="ltr" className="font-mono">{result.phoneMasked}</span> ويؤكّده، يجد دورته مفعّلة تلقائيًا.
            </p>
            <Alert tone="info">أرسلنا له رابط التسجيل في الرسالة نفسها. ساعده على التسجيل الآن إن أردت — دقيقة واحدة.</Alert>
            <Button size="lg" className="w-full" onClick={reset}>
              بيع جديد
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {result?.kind === 'ALREADY' ? (
        <Alert tone="warning" title={`${result.student.fullName} مشترك في «${result.courseTitle}» من قبل`} className="print:hidden">
          لم يُسجَّل بيع ولم تنقص باقاتك. <button type="button" className="font-bold underline" onClick={reset}>بيع جديد</button>
        </Alert>
      ) : null}

      {result?.kind === 'PICK' ? (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="text-base">هذا الرقم لأكثر من تلميذ — لمن الدورة؟</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.candidates.map((c) => (
              <button
                key={c.studentId}
                type="button"
                disabled={c.enrolled || pending}
                onClick={() => pick(result.ticket, c.studentId)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-start transition-colors hover:bg-muted disabled:opacity-60"
              >
                <span>
                  <span className="block font-bold">{c.fullName}</span>
                  <span className="block text-xs text-muted-foreground">{studentLine(c) || '—'}</span>
                </span>
                {c.enrolled ? <Badge variant="muted">مشترك من قبل</Badge> : <Badge>فعّل له</Badge>}
              </button>
            ))}
            <p className="text-xs text-muted-foreground">الاختيار متاح 10 دقائق.</p>
          </CardContent>
        </Card>
      ) : null}

      {/* ───── الكود الاحتياطي ───── */}
      {backup ? (
        <Card className="border-success/50 bg-success/5 print:border-0">
          <CardContent className="space-y-3 pt-5 text-center">
            <p className="text-sm text-muted-foreground">كود احتياطي «{backup.title}» — أعطه للتلميذ</p>
            <p dir="ltr" className="select-all font-mono text-4xl font-extrabold tracking-wider tabular-nums">{fmt(backup.code)}</p>
            <p className="text-xs text-muted-foreground">لا يفعّل إلا هذه الدورة، ومرة واحدة. يكتبه التلميذ في madrasadz.com/claim من حسابه.</p>
            <div className="flex flex-wrap justify-center gap-2 print:hidden">
              <Button asChild>
                <a href={waLink(shareText(backup.code, backup.title))} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4" /> أرسله عبر واتساب
                </a>
              </Button>
              <Button variant="outline" onClick={() => copy(backup.code)}>
                <Copy className="size-4" /> نسخ
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="size-4" /> طباعة
              </Button>
            </div>
            <p className="text-xs text-warning print:hidden">سلّمه للمشتري نفسه فقط: من يكتبه أولًا تُفعَّل له الدورة. يمكنك إلغاؤه خلال 48 ساعة إن أُرجعت الباقة.</p>
          </CardContent>
        </Card>
      ) : null}

      {/* ───── البيع ───── */}
      {summary.stock.length === 0 ? (
        <Alert tone="info" title="لا باقات عندك بعد">تُسجَّل الباقات هنا حين ترسلها إليك إدارة المنصة.</Alert>
      ) : (
        summary.stock.map((line) => {
          const active = step?.line.courseId === line.courseId ? step : null
          const disabled = !open || line.remaining <= 0
          return (
            <Card key={line.courseId} className="print:hidden">
              <CardContent className="space-y-4 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold leading-snug">{line.courseTitle}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">سعر الباقة: {line.priceDzd} دج</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-4xl font-extrabold tabular-nums ${line.remaining <= 0 ? 'text-destructive' : ''}`}>{line.remaining}</p>
                    <p className="text-xs text-muted-foreground">باقي عندك</p>
                  </div>
                </div>
                {active ? (
                  <div className="space-y-3">
                    <p className="text-sm">
                      أرسلنا رسالة فيها رمز من 6 أرقام إلى <span dir="ltr" className="font-mono font-bold">{active.phoneMasked}</span>. اطلبه من التلميذ:
                    </p>
                    <Input
                      aria-label="الرمز الذي وصل التلميذ"
                      value={active.code}
                      onChange={(e) => setStep({ ...active, code: digits(e.target.value).slice(0, 6) })}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="••••••"
                      dir="ltr"
                      className="h-16 text-center font-mono text-3xl font-extrabold tracking-[0.5em]"
                      autoFocus
                    />
                    <Button className="h-14 w-full text-base" size="lg" loading={pending} disabled={active.code.length < 4} onClick={confirm}>
                      <CheckCircle2 className="size-5" /> فعّل الدورة الآن
                    </Button>
                    <div className="flex items-center justify-center gap-5 text-sm">
                      {resendIn > 0 ? (
                        <span className="text-muted-foreground tabular-nums">أعد الإرسال بعد 0:{String(resendIn).padStart(2, '0')}</span>
                      ) : (
                        <button type="button" className="font-semibold text-primary" disabled={pending} onClick={() => send(line, active.phone)}>
                          أعد الإرسال
                        </button>
                      )}
                      <button type="button" className="font-semibold text-primary" onClick={() => setStep(null)}>
                        غيّر الرقم
                      </button>
                    </div>
                    <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground">الرمز صالح 5 دقائق، و5 محاولات. لا تُحسب الباقة مبيعة حتى يُفعَّل الرمز.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label htmlFor={`ph-${line.courseId}`} className="block text-sm font-semibold">
                      هاتف التلميذ
                    </label>
                    <Input
                      id={`ph-${line.courseId}`}
                      type="tel"
                      inputMode="tel"
                      dir="ltr"
                      placeholder="06XXXXXXXX"
                      value={phones[line.courseId] ?? ''}
                      onChange={(e) => setPhones((p) => ({ ...p, [line.courseId]: e.target.value }))}
                      className="h-14 text-center font-mono text-2xl tracking-wider"
                      disabled={disabled}
                    />
                    <p className="text-xs text-muted-foreground">هاتفه أو هاتف وليّه، والهاتف معه الآن.</p>
                    <Button className="h-14 w-full text-base" size="lg" disabled={disabled || digits(phones[line.courseId] ?? '').length < 10} loading={pending} onClick={() => send(line, phones[line.courseId] ?? '')}>
                      <Send className="size-5" /> أرسل رمز التفعيل للتلميذ
                    </Button>
                  </div>
                )}
                <button type="button" className="block w-full text-center text-sm font-semibold text-primary disabled:opacity-50" disabled={disabled || pending} onClick={() => backupCode(line)}>
                  {active ? 'لم تصله الرسالة؟ أعطني كودًا احتياطيًا' : 'التلميذ ليس معه هاتفه؟ أعطني كودًا احتياطيًا'}
                </button>
              </CardContent>
            </Card>
          )
        })
      )}

      <Card className="print:hidden">
        <CardContent className="grid grid-cols-2 gap-3 pt-5 text-center text-sm">
          <div>
            <p className="text-2xl font-bold tabular-nums">{summary.soldCount}</p>
            <p className="text-muted-foreground">باقات بعتها</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{summary.activatedCount}</p>
            <p className="text-muted-foreground">فُعّلت</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{summary.commissionDzd} دج</p>
            <p className="text-muted-foreground">عمولتك</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{summary.owedDzd} دج</p>
            <p className="text-muted-foreground">المستحق للمنصة</p>
          </div>
        </CardContent>
      </Card>

      <div className="print:hidden">
        {restock.open ? (
          <Card>
            <CardContent className="space-y-3 pt-5">
              <Input type="number" min={1} max={1000} inputMode="numeric" placeholder="كم باقة تحتاج؟" value={restock.qty} onChange={(e) => setRestock({ ...restock, qty: e.target.value })} dir="ltr" />
              <Input placeholder="ملاحظة (اختياري)" maxLength={200} value={restock.note} onChange={(e) => setRestock({ ...restock, note: e.target.value })} />
              <div className="flex gap-2">
                <Button onClick={sendRestock} loading={pending}>
                  إرسال الطلب
                </Button>
                <Button variant="ghost" onClick={() => setRestock({ open: false, qty: '', note: '' })}>
                  تراجع
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button variant="outline" className="w-full" onClick={() => setRestock({ ...restock, open: true })}>
            <PackagePlus className="size-4" /> اطلب باقات جديدة
          </Button>
        )}
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-base">مبيعاتي</CardTitle>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا مبيعات بعد.</p>
          ) : (
            <ul className="divide-y">
              {codes.map((c) => {
                const st = statusOf(c)
                const title = c.studentName ?? (c.soldVia === 'SMS' && c.soldPhoneMasked ? c.soldPhoneMasked : c.code ? fmt(c.code) : '—')
                const mono = !c.studentName
                return (
                  <li key={c.id} className="space-y-2 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span dir={mono ? 'ltr' : undefined} className={mono ? 'font-mono text-lg font-bold tabular-nums' : 'font-bold'}>
                        {title}
                      </span>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.courseTitle} · {formatDateTime(new Date(c.usedAt ?? c.createdAt))}
                      {c.studentName && c.soldPhoneMasked ? (
                        <>
                          {' · '}
                          <span dir="ltr">{c.soldPhoneMasked}</span>
                        </>
                      ) : null}
                      {c.soldBy ? ` · ${c.soldBy}` : ''}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {c.status === 'ACTIVE' && c.code ? (
                        <Button asChild size="sm" variant="outline">
                          <a href={waLink(shareText(c.code, c.courseTitle))} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="size-4" /> {c.soldVia === 'SMS' ? 'أرسل له الكود' : 'أرسله مرة أخرى'}
                          </a>
                        </Button>
                      ) : null}
                      {c.undoable ? (
                        <Button size="sm" variant="ghost" loading={pending} onClick={() => undo(c.id)}>
                          <Undo2 className="size-4 text-destructive" /> تراجع (24 ساعة)
                        </Button>
                      ) : null}
                      {c.cancellable ? (
                        <Button size="sm" variant="ghost" loading={pending} onClick={() => cancel(c)}>
                          <XCircle className="size-4 text-destructive" /> إلغاء (أُرجعت الباقة)
                        </Button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
