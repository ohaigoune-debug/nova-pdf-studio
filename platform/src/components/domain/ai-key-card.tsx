'use client'

import { KeyRound, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { formatDateTime } from '@/lib/utils'
import { clearAiKeyAction, saveAiKeyAction } from '@/server/actions/ai.actions'

type ProviderName = 'openai' | 'anthropic'

interface Props {
  saved: { provider: ProviderName; model: string; hint: string; updatedAt: string; usable: boolean } | null
  active: { name: string; model: string; source: 'admin' | 'env' | 'none' | 'test' }
  defaults: Record<ProviderName, string>
  suggestions: Record<ProviderName, string[]>
}

const LABEL: Record<ProviderName, string> = { openai: 'OpenAI (ChatGPT)', anthropic: 'Anthropic (Claude)' }
const KEYS_URL: Record<ProviderName, string> = { openai: 'https://platform.openai.com/api-keys', anthropic: 'https://console.anthropic.com/settings/keys' }
const SOURCE: Record<Props['active']['source'], string> = { admin: 'من هذه اللوحة', env: 'من ملف البيئة على الخادم', none: 'غير مضبوط — وضع تجريبي', test: 'اختبار' }

/** إدخال مفتاح الذكاء الاصطناعي: يُختبر عند المزوّد ثم يُحفظ مشفّراً، ولا يُعرض بعدها إلا آخر 4 أحرف */
export function AiKeyCard({ saved, active, defaults, suggestions }: Props) {
  const router = useRouter()
  const [provider, setProvider] = useState<ProviderName>(saved?.provider ?? 'openai')
  const [state, action] = useActionState(saveAiKeyAction, null)
  const [pending, start] = useTransition()
  const form = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.ok) {
      toast('success', `حُفظ المفتاح (…${state.data.hint}) وجُرِّب بنجاح`)
      form.current?.reset()
    }
  }, [state])

  const clear = () => {
    if (!confirm('حذف المفتاح المحفوظ هنا؟ ستعود المنصة إلى مفتاح ملف البيئة إن وُجد.')) return
    start(async () => {
      const r = await clearAiKeyAction()
      if (!r.ok) toast('error', r.error.message)
      else {
        toast('success', 'حُذف المفتاح')
        router.refresh()
      }
    })
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5 text-primary" /> مفتاح الذكاء الاصطناعي
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3">
          <span className="text-muted-foreground">المستعمل الآن:</span>
          <Badge variant={active.source === 'none' ? 'destructive' : 'success'}>
            <span dir="ltr">
              {active.name} · {active.model}
            </span>
          </Badge>
          <span className="text-xs text-muted-foreground">({SOURCE[active.source]})</span>
        </div>

        {saved ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
            <span>
              مفتاح محفوظ: <strong>{LABEL[saved.provider]}</strong> ·{' '}
              <span dir="ltr" className="font-mono">
                …{saved.hint}
              </span>{' '}
              · <span dir="ltr">{saved.model}</span>
              {saved.updatedAt ? <span className="block text-xs text-muted-foreground">آخر تحديث: {formatDateTime(new Date(saved.updatedAt))}</span> : null}
              {!saved.usable ? <span className="block text-xs text-destructive">لا يمكن فكّ تشفيره (تغيّر سرّ الخادم): أدخله من جديد.</span> : null}
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={clear} loading={pending}>
              <Trash2 className="size-4" /> حذف
            </Button>
          </div>
        ) : null}

        <form ref={form} action={action} className="space-y-3" autoComplete="off">
          {/* أزرار لا حقول: React يعيد ضبط حقول النموذج بعد كل إرسال فيضيع اختيار المزوّد */}
          <input type="hidden" name="provider" value={provider} />
          <div role="radiogroup" aria-label="المزوّد" className="space-y-1">
            <span className="text-sm font-semibold">المزوّد</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {(['openai', 'anthropic'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={provider === p}
                  onClick={() => setProvider(p)}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-start transition-colors ${provider === p ? 'border-primary bg-primary/5' : 'hover:border-primary/40'}`}
                >
                  <span className={`grid size-4 place-items-center rounded-full border ${provider === p ? 'border-primary' : 'border-muted-foreground/50'}`}>
                    {provider === p ? <span className="size-2 rounded-full bg-primary" /> : null}
                  </span>
                  <span className="font-semibold">{LABEL[p]}</span>
                </button>
              ))}
            </div>
          </div>

          <Field label="المفتاح" htmlFor="ai-key" error={fieldError(state, 'apiKey')} hint={`يبدأ بـ ${provider === 'openai' ? 'sk' : 'sk-ant'} · يُخزَّن مشفّراً ولا يُعرض بعد الحفظ إلا آخر 4 أحرف.`}>
            <Input id="ai-key" name="apiKey" type="password" dir="ltr" required spellCheck={false} autoComplete="new-password" placeholder={provider === 'openai' ? 'sk-…' : 'sk-ant-…'} />
          </Field>

          <Field label="النموذج (اختياري)" htmlFor="ai-model" error={fieldError(state, 'model')} hint={`فارغ = ${defaults[provider]}`}>
            <Input id="ai-model" name="model" dir="ltr" list={`ai-models-${provider}`} placeholder={defaults[provider]} spellCheck={false} />
            <datalist id={`ai-models-${provider}`}>
              {suggestions[provider].map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>

          <FormError state={state} />
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton size="sm">اختبار وحفظ</SubmitButton>
            <a href={KEYS_URL[provider]} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
              أين أجد مفتاحي؟
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            يُجرَّب المفتاح عند المزوّد أولاً (طلب مجاني)، ولا يُحفظ إن رُفض. المفتاح المحفوظ هنا يتقدّم على ملف البيئة، ويسري فوراً دون إعادة تشغيل.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
