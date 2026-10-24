'use client'

import { Bot, Coins, RefreshCcw, Send, Trash2, Truck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, useTransition } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { formatDateTime } from '@/lib/utils'
import type { TelegramConfig } from '@/server/lib/telegram'
import { clearEcotrackAction, clearTelegramAction, saveEcotrackAction, saveTelegramAction, syncEcotrackFeesAction, syncEcotrackNowAction, testTelegramAction } from '@/server/actions/ecotrack.actions'
import type { EcotrackStatus } from '@/server/services/ecotrack.service'

/** حساب EcoTrack: رابط المنصّة + رمز API (يُختم)، تفعيل، إرسال تلقائي عند التأكيد، وجلب الرسوم ومزامنة فورية */
export function EcotrackSettingsForm({ status }: { status: EcotrackStatus }) {
  const router = useRouter()
  const [state, action] = useActionState(saveEcotrackAction, null)
  const [pending, start] = useTransition()
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state?.ok) {
      toast('success', `حُفظ حساب EcoTrack (${state.data.lastCheck?.message ?? 'تم التحقق'})`)
      form.current?.reset()
      router.refresh()
    }
  }, [state, router])
  const s = state?.ok ? state.data : status
  const run = (fn: () => Promise<{ ok: true; data: unknown } | { ok: false; error: { message: string } }>, msg: (d: never) => string) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) return toast('error', r.error.message)
      toast('success', msg(r.data as never))
      router.refresh()
    })
  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3">
        <Truck className="size-4 text-primary" />
        {s.configured ? (
          <>
            <Badge variant={s.enabled ? 'success' : 'muted'}>{s.enabled ? 'مفعّل' : 'محفوظ لكن معطَّل'}</Badge>
            <span dir="ltr" className="font-mono text-xs">
              {s.baseUrl}
            </span>
            <span className="text-xs text-muted-foreground">
              رمز …{s.hint} · {s.updatedAt ? formatDateTime(new Date(s.updatedAt)) : ''}
            </span>
            {s.autoSend ? <Badge variant="secondary">إرسال تلقائي عند التأكيد</Badge> : null}
            <Button type="button" size="sm" variant="ghost" loading={pending} onClick={() => confirm('حذف حساب EcoTrack المحفوظ؟') && run(clearEcotrackAction, () => 'حُذف الحساب')}>
              <Trash2 className="size-4" /> حذف
            </Button>
          </>
        ) : s.unusable ? (
          <span className="text-destructive">الرمز المحفوظ لا يُفتح (تغيّر سرّ الخادم): أدخله من جديد.</span>
        ) : (
          <span className="text-muted-foreground">لا حساب بعد. الصق رابط منصّتك ورمز API من حساب EcoTrack (الإعدادات ← API).</span>
        )}
      </div>

      <form ref={form} action={action} className="space-y-3" autoComplete="off">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="رابط المنصّة" htmlFor="eco-url" error={fieldError(state, 'baseUrl')} hint="https://<شركتك>.ecotrack.dz">
            <Input id="eco-url" name="baseUrl" dir="ltr" placeholder="https://xxx.ecotrack.dz" defaultValue={s.baseUrl ?? ''} required />
          </Field>
          <Field label={s.configured ? 'رمز API جديد (اتركه فارغاً للإبقاء على المحفوظ)' : 'رمز API'} htmlFor="eco-token" error={fieldError(state, 'apiToken')} hint="يُخزَّن مشفّراً ولا يُعرض بعد الحفظ">
            <Input id="eco-token" name="apiToken" type="password" dir="ltr" spellCheck={false} autoComplete="new-password" required={!s.configured} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="enabled" className="size-4" defaultChecked={s.configured ? s.enabled : true} /> تفعيل EcoTrack
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="autoSend" className="size-4" defaultChecked={s.autoSend} /> إرسال الطرد تلقائياً عند تأكيد الطلب
          </label>
        </div>
        <FormError state={state} />
        <SubmitButton size="sm">حفظ والتحقق من الرمز</SubmitButton>
      </form>

      {s.configured ? (
        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button type="button" size="sm" variant="outline" loading={pending} onClick={() => run(syncEcotrackFeesAction, (d: { count: number }) => `حُفظت رسوم ${d.count} ولاية — تُستعمل في السلة`)}>
            <Coins className="size-4" /> جلب رسوم التوصيل
          </Button>
          <Button type="button" size="sm" variant="outline" loading={pending} onClick={() => run(syncEcotrackNowAction, (d: { polled: number; changed: number; delivered: number; failed: number; skipped: string | null }) => `استُطلع ${d.polled} طرد · تغيّر ${d.changed} · سُلِّم ${d.delivered}${d.failed ? ` · فشل ${d.failed}` : ''}${d.skipped ? ` · ${d.skipped}` : ''}`)}>
            <RefreshCcw className="size-4" /> مزامنة التتبّع الآن
          </Button>
          <span className="text-xs text-muted-foreground">{s.feesCount ? `جدول الرسوم: ${s.feesCount} ولاية${s.feesSyncedAt ? ` · ${formatDateTime(new Date(s.feesSyncedAt))}` : ''}` : 'لا جدول رسوم بعد: يُستعمل الرسم الثابت.'} · المزامنة التلقائية كل 20 دقيقة.</span>
        </div>
      ) : null}
    </div>
  )
}

/** إشعارات تيليغرام للمشرف: بوت + معرّف محادثة، مع رسالة اختبار */
export function TelegramSettingsForm({ cfg }: { cfg: TelegramConfig }) {
  const router = useRouter()
  const [state, action] = useActionState(saveTelegramAction, null)
  const [pending, start] = useTransition()
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state?.ok) {
      toast('success', state.data.botUsername ? `حُفظ البوت @${state.data.botUsername}` : 'حُفظ إعداد تيليغرام')
      form.current?.reset()
      router.refresh()
    }
  }, [state, router])
  const c = state?.ok ? state.data : cfg
  const test = () =>
    start(async () => {
      const r = await testTelegramAction()
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'أُرسلت رسالة الاختبار إلى تيليغرام')
    })
  const clear = () =>
    start(async () => {
      if (!confirm('حذف إعداد تيليغرام؟')) return
      const r = await clearTelegramAction()
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'حُذف')
      router.refresh()
    })
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3">
        <Bot className="size-4 text-primary" />
        {c.hint ? (
          <>
            <Badge variant={c.enabled ? 'success' : 'muted'}>{c.enabled ? 'مفعّل' : 'معطَّل'}</Badge>
            <span className="text-xs text-muted-foreground">
              {c.botUsername ? `@${c.botUsername}` : 'بوت'} · رمز …{c.hint} · محادثة <span dir="ltr">{c.chatId || '—'}</span>
            </span>
            <Button type="button" size="sm" variant="outline" loading={pending} onClick={test}>
              <Send className="size-4" /> رسالة اختبار
            </Button>
            <Button type="button" size="sm" variant="ghost" loading={pending} onClick={clear}>
              <Trash2 className="size-4" /> حذف
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground">أنشئ بوتاً عبر @BotFather، أرسل له «/start»، ثم ضع رمزه ومعرّف محادثتك (من @userinfobot) هنا.</span>
        )}
      </div>
      <form ref={form} action={action} className="space-y-3" autoComplete="off">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={c.hint ? 'رمز البوت الجديد (اختياري)' : 'رمز البوت'} htmlFor="tg-token" error={fieldError(state, 'token')}>
            <Input id="tg-token" name="token" type="password" dir="ltr" spellCheck={false} autoComplete="new-password" placeholder="123456:ABC…" required={!c.hint} />
          </Field>
          <Field label="معرّف المحادثة (chat_id)" htmlFor="tg-chat" error={fieldError(state, 'chatId')} hint="رقمك أو رقم مجموعة الفريق (يبدأ بـ -100)">
            <Input id="tg-chat" name="chatId" dir="ltr" inputMode="numeric" defaultValue={c.chatId} required />
          </Field>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="enabled" className="size-4" defaultChecked={c.hint ? c.enabled : true} /> إرسال إشعارات الطلبات والتوصيل إلى تيليغرام
        </label>
        <FormError state={state} />
        <SubmitButton size="sm">حفظ</SubmitButton>
      </form>
    </div>
  )
}
