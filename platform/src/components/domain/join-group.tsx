'use client'

import { CheckCircle2, KeyRound, UsersRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { useT } from '@/i18n/client'
import { activateCodeAction } from '@/server/actions/auth.actions'

/**
 * الانضمام إلى فوج بكود الأستاذ من داخل فضاء التلميذ (بلا مغادرته إلى صفحة مستقلة).
 * نجاح التفعيل يحدّث الصفحة فتظهر الحصص وبطاقة الحضور فوراً.
 */
export function JoinGroupForm({ code, onDone, autoFocus = true }: { code?: string; onDone?: () => void; autoFocus?: boolean }) {
  const t = useT()
  const router = useRouter()
  const [state, action] = useActionState(activateCodeAction, null)
  useEffect(() => {
    if (!state?.ok) return
    toast('success', t('activate.success', { group: state.data.groupName }))
    router.refresh()
    onDone?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])
  if (state?.ok) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 p-4 text-sm">
        <CheckCircle2 className="size-6 shrink-0 text-success" />
        <span className="font-bold">{t('activate.success', { group: state.data.groupName })}</span>
      </div>
    )
  }
  return (
    <form action={action} className="space-y-3">
      <Field label={t('activate.codeLabel')} htmlFor="join-code" error={fieldError(state, 'code')}>
        <Input id="join-code" name="code" defaultValue={code ?? ''} placeholder={t('activate.codePlaceholder')} required dir="ltr" autoFocus={autoFocus} className="h-12 text-center font-mono text-xl uppercase tracking-[0.3em]" autoComplete="off" />
      </Field>
      <FormError state={state} />
      <SubmitButton className="w-full">
        <KeyRound className="size-4" /> {t('activate.button')}
      </SubmitButton>
    </form>
  )
}

/** بطاقة بارزة في الصفحة الرئيسية للتلميذ الذي لم ينضم إلى أي فوج بعد */
export function JoinGroupCard({ code }: { code?: string }) {
  const t = useT()
  return (
    <Card id="join" className="border-primary/30 bg-primary/5">
      <CardContent className="grid gap-4 p-5 sm:grid-cols-[1fr_minmax(16rem,22rem)] sm:items-center">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-lg font-extrabold">
            <UsersRound className="size-5 text-primary" /> {t('studentPages.joinTitle')}
          </p>
          <p className="text-sm text-muted-foreground">{t('studentPages.joinHint')}</p>
        </div>
        <JoinGroupForm code={code} />
      </CardContent>
    </Card>
  )
}

/** زرّ مع نافذة: للتلميذ المسجَّل سلفاً كي ينضم إلى أفواج أساتذة آخرين */
export function JoinGroupMenu({ code, open: initialOpen = false, variant = 'outline', size = 'default' }: { code?: string; open?: boolean; variant?: 'outline' | 'ghost' | 'gold' | 'default'; size?: 'sm' | 'default' | 'lg' }) {
  const t = useT()
  const [open, setOpen] = useState(initialOpen)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <KeyRound className="size-4" /> {t('studentPages.joinAnother')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('studentPages.joinAnother')}</DialogTitle>
          <DialogDescription>{t('studentPages.joinHint')}</DialogDescription>
        </DialogHeader>
        <JoinGroupForm code={code} onDone={() => setTimeout(() => setOpen(false), 1200)} />
      </DialogContent>
    </Dialog>
  )
}
