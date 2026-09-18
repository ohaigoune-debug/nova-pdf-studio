'use client'

import { Copy, KeyRound, UserCog, UserX } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useState, useTransition } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert, Avatar, EmptyState } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import { t, tEnum } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { createAssistantCodeAction, disableAssistantCodeAction, revokeAssistantAction } from '@/server/actions/assistants.actions'
import type { AssistantListItem, PendingAssistantCode } from '@/server/services/assistants.service'

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setDone(true)
          setTimeout(() => setDone(false), 2000)
        } catch {
          toast('error', t('errors.INTERNAL'))
        }
      }}
    >
      <Copy className="size-4" /> {done ? t('assistant.copied') : label}
    </Button>
  )
}

export function AssistantsPanel({ assistants, pendingCodes, origin }: { assistants: AssistantListItem[]; pendingCodes: PendingAssistantCode[]; origin: string }) {
  const router = useRouter()
  const [state, action] = useActionState(createAssistantCodeAction, null)
  const [pending, start] = useTransition()
  const generated = state?.ok ? state.data : null
  const joinUrl = generated ? `${origin}/assistant-join?code=${encodeURIComponent(generated.code)}&email=${encodeURIComponent(generated.email)}` : ''

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5" /> {t('assistant.inviteTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {generated ? (
            <div className="space-y-4">
              <Alert tone="success">{t('assistant.generated', { email: generated.email })}</Alert>
              <div className="rounded-lg border bg-muted/40 p-4 text-center">
                <p className="font-mono text-3xl font-extrabold tracking-[0.3em]" dir="ltr">
                  {generated.code}
                </p>
                {generated.expiresAt ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('codes.expiresAt')}: {formatDateTime(generated.expiresAt)}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={generated.code} label={t('assistant.copy')} />
                <CopyButton value={joinUrl} label={t('assistant.joinLink')} />
              </div>
              <p className="break-all text-[11px] text-muted-foreground" dir="ltr">
                {joinUrl}
              </p>
              <Button type="button" variant="ghost" className="w-full" onClick={() => router.refresh()}>
                {t('common.close')}
              </Button>
            </div>
          ) : (
            <form action={action} className="space-y-4">
              <Field label={t('assistant.email')} htmlFor="email" error={fieldError(state, 'email')}>
                <Input id="email" name="email" type="email" placeholder={t('assistant.emailPlaceholder')} required dir="ltr" autoComplete="off" />
              </Field>
              <Field label={t('assistant.expiresIn')} htmlFor="expiresDays">
                <Select id="expiresDays" name="expiresDays" defaultValue="7">
                  <option value="1">{t('assistant.days', { n: 1 })}</option>
                  <option value="7">{t('assistant.days', { n: 7 })}</option>
                  <option value="30">{t('assistant.days', { n: 30 })}</option>
                  <option value="0">{t('assistant.noExpiry')}</option>
                </Select>
              </Field>
              <FormError state={state} />
              <SubmitButton className="w-full">{t('assistant.generate')}</SubmitButton>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="size-5" /> {t('assistant.listTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assistants.length === 0 ? (
              <EmptyState icon={UserCog} title={t('assistant.noAssistants')} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tEnum('roles', 'ASSISTANT')}</TableHead>
                    <TableHead>{t('assistant.joinedAt')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assistants.map((a) => (
                    <TableRow key={a.id} className={a.status !== 'ACTIVE' ? 'opacity-60' : undefined}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar name={a.fullName} size="sm" />
                          <span>
                            <span className="block font-semibold">{a.fullName}</span>
                            <span className="block text-[11px] text-muted-foreground" dir="ltr">
                              {a.email}
                            </span>
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="tabular">{formatDateTime(a.joinedAt)}</TableCell>
                      <TableCell>
                        <Badge variant={a.status === 'ACTIVE' ? 'success' : 'muted'}>{a.status === 'ACTIVE' ? t('assistant.active') : t('assistant.revoked')}</Badge>
                      </TableCell>
                      <TableCell className="text-end">
                        {a.status === 'ACTIVE' ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            loading={pending}
                            onClick={() => {
                              if (!confirm(t('assistant.revokeConfirm'))) return
                              start(async () => {
                                const r = await revokeAssistantAction(a.id)
                                if (!r.ok) toast('error', r.error.message)
                                else {
                                  toast('success', t('common.success'))
                                  router.refresh()
                                }
                              })
                            }}
                          >
                            <UserX className="size-4" /> {t('assistant.revoke')}
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('assistant.pendingTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingCodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('assistant.noPending')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('codes.prefix')}</TableHead>
                    <TableHead>{t('assistant.email')}</TableHead>
                    <TableHead>{t('codes.expiresAt')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingCodes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono" dir="ltr">
                        {c.codePrefix}-****
                      </TableCell>
                      <TableCell dir="ltr" className="text-start">
                        {c.email}
                      </TableCell>
                      <TableCell className="tabular">{c.expiresAt ? formatDateTime(c.expiresAt) : t('assistant.noExpiry')}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === 'ACTIVE' ? 'success' : 'warning'}>{tEnum('codeStatus', c.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={pending}
                          onClick={() =>
                            start(async () => {
                              const r = await disableAssistantCodeAction(c.id)
                              if (!r.ok) toast('error', r.error.message)
                              else router.refresh()
                            })
                          }
                        >
                          {t('assistant.disableCode')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
