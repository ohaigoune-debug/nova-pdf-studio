'use client'

import { Ban, Copy, Download, KeyRound, Printer, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState, useTransition } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { CodeStatusBadge } from '@/components/domain/status-badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert, EmptyState, StatCard } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { cancelBatchAction, disableCodeAction, generateCodesAction, type GenerateCodesData } from '@/server/actions/codes.actions'
import type { ActionResult } from '@/server/lib/action-result'

interface CodeRow {
  id: string
  codePrefix: string
  status: string
  expiresAt: Date | null
  usedAt: Date | null
  createdAt: Date
  batchId: string | null
  batchLabel: string | null
  usedByName: string | null
  usedByEmail: string | null
}
interface BatchRow {
  id: string
  label: string | null
  count: number
  createdAt: Date
  cancelledAt: Date | null
}

function csvOf(codes: GenerateCodesData['codes'], group: string) {
  const lines = ['code,group,expires_at', ...codes.map((c) => `${c.code},"${group.replace(/"/g, '""')}",${c.expiresAt ? new Date(c.expiresAt).toISOString() : ''}`)]
  return '﻿' + lines.join('\n')
}

export function CodesPanel({ groupId, groupName, codes, batches }: { groupId: string; groupName: string; codes: CodeRow[]; batches: BatchRow[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, action] = useActionState<ActionResult<GenerateCodesData> | null, FormData>(generateCodesAction, null)
  const [generated, setGenerated] = useState<GenerateCodesData | null>(null)
  const [pending, start] = useTransition()

  useEffect(() => {
    if (state?.ok) {
      setGenerated(state.data)
      setOpen(false)
      router.refresh()
    }
  }, [state, router])

  const active = codes.filter((c) => c.status === 'ACTIVE')
  const used = codes.filter((c) => c.status === 'USED')
  const other = codes.filter((c) => c.status !== 'ACTIVE' && c.status !== 'USED')

  const copyAll = async () => {
    if (!generated) return
    await navigator.clipboard.writeText(generated.codes.map((c) => c.code).join('\n'))
    toast('success', t('common.copied'))
  }
  const downloadCsv = () => {
    if (!generated) return
    const blob = new Blob([csvOf(generated.codes, groupName)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `codes-${groupName}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const printCodes = () => {
    if (!generated) return
    const w = window.open('', '_blank')
    if (!w) return
    const cards = generated.codes
      .map(
        (c) =>
          `<div class="card"><div class="g">${groupName}</div><div class="c">${c.code}</div><div class="h">${t('codes.printHint')}</div>${c.expiresAt ? `<div class="e">${new Date(c.expiresAt).toLocaleDateString('ar-DZ')}</div>` : ''}</div>`
      )
      .join('')
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${t('codes.printTitle', { group: groupName })}</title>
<style>body{font-family:Tahoma,sans-serif;margin:16px}h1{font-size:18px;margin:0 0 12px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.card{border:1px dashed #999;border-radius:10px;padding:12px;text-align:center;page-break-inside:avoid}.g{font-size:12px;color:#555}.c{font-family:monospace;font-size:26px;font-weight:bold;letter-spacing:3px;margin:8px 0;direction:ltr}.h{font-size:10px;color:#666}.e{font-size:10px;color:#a00}</style></head><body><h1>${t('codes.printTitle', { group: groupName })}</h1><div class="grid">${cards}</div></body></html>`)
    w.document.close()
    // بلا سكربت مضمّن (CSP): نطبع من نافذة الأصل بعد اكتمال التحميل
    const print = () => {
      try {
        w.focus()
        w.print()
      } catch {
        /* نافذة مغلقة */
      }
    }
    if (w.document.readyState === 'complete') setTimeout(print, 150)
    else w.addEventListener('load', () => setTimeout(print, 150), { once: true })
  }

  const disable = (id: string) =>
    start(async () => {
      const r = await disableCodeAction(id, groupId)
      if (!r.ok) toast('error', r.error.message)
      else router.refresh()
    })
  const cancel = (batchId: string) => {
    if (!confirm(t('codes.cancelBatchConfirm'))) return
    start(async () => {
      const r = await cancelBatchAction(batchId, groupId)
      if (!r.ok) toast('error', r.error.message)
      else {
        toast('success', `${r.data.disabled} ${t('codes.disable')}`)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <KeyRound className="size-4" /> {t('codes.generate')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('codes.generate')}</DialogTitle>
              <DialogDescription>{groupName}</DialogDescription>
            </DialogHeader>
            <form action={action} className="space-y-4">
              <input type="hidden" name="groupId" value={groupId} />
              <Field label={t('codes.count')} htmlFor="count" error={fieldError(state, 'count')}>
                <Input id="count" name="count" type="number" min={1} max={500} defaultValue={30} required />
              </Field>
              <Field label={t('codes.label')} htmlFor="label">
                <Input id="label" name="label" placeholder={t('codes.labelPlaceholder')} />
              </Field>
              <Field label={`${t('codes.expiresAt')} (${t('common.optional')})`} htmlFor="expiresAt">
                <Input id="expiresAt" name="expiresAt" type="date" dir="ltr" />
              </Field>
              <FormError state={state} />
              <SubmitButton className="w-full">{t('codes.generateBatch')}</SubmitButton>
            </form>
          </DialogContent>
        </Dialog>
        <div className="ms-auto grid grid-cols-3 gap-2">
          <StatCard label={t('codes.unused')} value={active.length} className="py-2" />
          <StatCard label={t('codes.used')} value={used.length} className="py-2" />
          <StatCard label={t('codeStatus.DISABLED')} value={other.length} className="py-2" />
        </div>
      </div>

      {generated ? (
        <Card className="border-primary/40">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>{t('codes.generated', { n: generated.codes.length })}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={copyAll}>
                <Copy className="size-4" /> {t('common.copy')}
              </Button>
              <Button size="sm" variant="outline" onClick={downloadCsv}>
                <Download className="size-4" /> {t('common.exportCsv')}
              </Button>
              <Button size="sm" variant="outline" onClick={printCodes}>
                <Printer className="size-4" /> {t('common.print')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Alert tone="warning" className="mb-3">
              الكود الكامل لا يُخزَّن في قاعدة البيانات؛ احفظه أو اطبعه الآن.
            </Alert>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5" dir="ltr">
              {generated.codes.map((c) => (
                <div key={c.id} className="rounded-md border bg-muted/40 p-2 text-center font-mono text-lg font-bold tracking-widest">
                  {c.code}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            {t('codes.unused')} ({active.length})
          </TabsTrigger>
          <TabsTrigger value="used">
            {t('codes.used')} ({used.length})
          </TabsTrigger>
          <TabsTrigger value="batches">
            {t('codes.batch')} ({batches.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <CodesTable rows={active} onDisable={disable} pending={pending} />
        </TabsContent>
        <TabsContent value="used">
          <CodesTable rows={[...used, ...other]} pending={pending} />
        </TabsContent>
        <TabsContent value="batches">
          {batches.length === 0 ? (
            <EmptyState title={t('codes.noCodes')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('codes.label')}</TableHead>
                  <TableHead>{t('codes.count')}</TableHead>
                  <TableHead>{t('common.date')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-semibold">{b.label ?? '—'}</TableCell>
                    <TableCell className="tabular">{b.count}</TableCell>
                    <TableCell className="tabular">{formatDateTime(b.createdAt)}</TableCell>
                    <TableCell>{b.cancelledAt ? <CodeStatusBadge status="DISABLED" /> : <CodeStatusBadge status="ACTIVE" />}</TableCell>
                    <TableCell className="text-end">
                      {!b.cancelledAt ? (
                        <Button size="sm" variant="ghost" loading={pending} onClick={() => cancel(b.id)}>
                          <Trash2 className="size-4" /> {t('codes.cancelBatch')}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function CodesTable({ rows, onDisable, pending }: { rows: CodeRow[]; onDisable?: (id: string) => void; pending: boolean }) {
  if (rows.length === 0) return <EmptyState icon={KeyRound} title={t('codes.noCodes')} />
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('codes.prefix')}</TableHead>
          <TableHead>{t('common.status')}</TableHead>
          <TableHead>{t('codes.batch')}</TableHead>
          <TableHead>{t('codes.expiresAt')}</TableHead>
          <TableHead>{t('codes.usedBy')}</TableHead>
          {onDisable ? <TableHead /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-mono" dir="ltr">
              {c.codePrefix}-••••
            </TableCell>
            <TableCell>
              <CodeStatusBadge status={c.status} />
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{c.batchLabel ?? '—'}</TableCell>
            <TableCell className="text-xs tabular">{c.expiresAt ? formatDateTime(c.expiresAt) : '—'}</TableCell>
            <TableCell className="text-sm">
              {c.usedByName ?? '—'}
              {c.usedAt ? <span className="block text-[11px] text-muted-foreground">{formatDateTime(c.usedAt)}</span> : null}
            </TableCell>
            {onDisable ? (
              <TableCell className="text-end">
                <Button size="sm" variant="ghost" loading={pending} onClick={() => onDisable(c.id)}>
                  <Ban className="size-4" /> {t('codes.disable')}
                </Button>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
