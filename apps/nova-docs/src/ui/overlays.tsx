/** أوراق منبثقة (Sheet) وقوائم إجراءات (Action Sheet) وتنبيهات وإشعارات مؤقتة — بأسلوب iOS. */
import clsx from 'clsx'
import { type ReactNode, useEffect } from 'react'
import { create } from 'zustand'
import { useTranslation } from 'react-i18next'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

export function Sheet({ open, onClose, title, children, trailing, full = false, leading }: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  trailing?: ReactNode
  leading?: ReactNode
  full?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/35 animate-fade-in" onClick={onClose} />
      <div
        className={clsx(
          'relative flex w-full flex-col overflow-hidden rounded-t-sheet bg-bg shadow-float animate-sheet-up md:max-w-[560px] md:rounded-sheet md:animate-pop-in',
          full ? 'h-[94vh] md:h-[86vh]' : 'max-h-[90vh]'
        )}
        style={{ paddingBottom: 'var(--safe-bottom)' }}
      >
        <div className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-muted/35 md:hidden" />
        {(title || trailing || leading) && (
          <div className="flex h-12 items-center gap-2 px-4">
            <div className="min-w-[64px]">{leading}</div>
            <div className="flex-1 truncate text-center text-[17px] font-semibold">{title}</div>
            <div className="flex min-w-[64px] justify-end">{trailing}</div>
          </div>
        )}
        <div className="ios-scroll flex-1 pb-4">{children}</div>
      </div>
    </div>
  )
}

export interface ActionItem {
  label: ReactNode
  icon?: ReactNode
  onSelect: () => void
  destructive?: boolean
  pro?: boolean
  hidden?: boolean
}

export function ActionSheet({ open, onClose, title, actions }: { open: boolean; onClose: () => void; title?: ReactNode; actions: ActionItem[] }) {
  const { t } = useTranslation()
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-2 md:items-center" style={{ paddingBottom: 'calc(var(--safe-bottom) + 8px)' }}>
      <div className="absolute inset-0 bg-black/35 animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-[420px] animate-sheet-up md:animate-pop-in">
        <div className="overflow-hidden rounded-[14px] glass">
          {title && <div className="border-b hairline px-4 py-3 text-center text-[13px] text-muted">{title}</div>}
          {actions.filter((a) => !a.hidden).map((a, i) => (
            <button
              key={i}
              onClick={() => {
                onClose()
                a.onSelect()
              }}
              className={clsx('pressable flex h-[56px] w-full items-center justify-center gap-2 border-b hairline text-[19px] last:border-0', a.destructive ? 'text-danger' : 'text-accent')}
            >
              {a.icon}
              {a.label}
              {a.pro && <span className="ms-1 rounded bg-accent/15 px-1 text-[10px] font-bold text-accent">PRO</span>}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="pressable mt-2 h-[56px] w-full rounded-[14px] bg-surface text-[19px] font-semibold text-accent">
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ تنبيهات وإدخال نصي
interface DialogState {
  dialog: null | { kind: 'confirm' | 'prompt'; title: string; message?: string; value?: string; destructive?: boolean; confirmLabel?: string; resolve: (v: string | boolean | null) => void }
  open: (d: NonNullable<DialogState['dialog']>) => void
  close: () => void
}
const useDialog = create<DialogState>((set) => ({ dialog: null, open: (dialog) => set({ dialog }), close: () => set({ dialog: null }) }))

export function confirmDialog(title: string, opts: { message?: string; destructive?: boolean; confirmLabel?: string } = {}): Promise<boolean> {
  return new Promise((resolve) => useDialog.getState().open({ kind: 'confirm', title, ...opts, resolve: (v) => resolve(!!v) }))
}
export function promptDialog(title: string, value = '', opts: { message?: string; confirmLabel?: string } = {}): Promise<string | null> {
  return new Promise((resolve) => useDialog.getState().open({ kind: 'prompt', title, value, ...opts, resolve: (v) => resolve(typeof v === 'string' ? v : null) }))
}

export function DialogHost() {
  const { t } = useTranslation()
  const { dialog, close } = useDialog()
  if (!dialog) return null
  let value = dialog.value ?? ''
  const finish = (v: string | boolean | null) => {
    close()
    dialog.resolve(v)
  }
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-8">
      <div className="absolute inset-0 bg-black/35 animate-fade-in" />
      <div className="relative w-full max-w-[290px] overflow-hidden rounded-[14px] glass text-center animate-pop-in">
        <div className="px-4 pb-4 pt-5">
          <div className="text-[17px] font-semibold">{dialog.title}</div>
          {dialog.message && <div className="mt-1 text-[13px]">{dialog.message}</div>}
          {dialog.kind === 'prompt' && (
            <input
              autoFocus
              defaultValue={value}
              onChange={(e) => (value = e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && finish(value.trim() || null)}
              className="mt-3 h-9 w-full rounded-[8px] border hairline bg-surface px-2 text-[15px] outline-none"
            />
          )}
        </div>
        <div className="grid grid-cols-2 border-t hairline">
          <button className="h-11 border-e hairline text-[17px] text-accent" onClick={() => finish(dialog.kind === 'prompt' ? null : false)}>{t('common.cancel')}</button>
          <button className={clsx('h-11 text-[17px] font-semibold', dialog.destructive ? 'text-danger' : 'text-accent')} onClick={() => finish(dialog.kind === 'prompt' ? value.trim() || null : true)}>
            {dialog.confirmLabel ?? t('common.ok')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ إشعارات مؤقتة
interface Toast { id: number; text: string; tone: 'ok' | 'error' | 'info' }
const useToasts = create<{ toasts: Toast[]; push: (t: Omit<Toast, 'id'>) => void; drop: (id: number) => void }>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Date.now() + Math.random()
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.tone === 'error' ? 4200 : 2600)
  },
  drop: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
}))

export function toast(text: string, tone: Toast['tone'] = 'ok'): void {
  useToasts.getState().push({ text, tone })
  void (tone === 'error' ? Haptics.notification({ type: NotificationType.Error }) : Haptics.impact({ style: ImpactStyle.Light })).catch(() => undefined)
}

export function ToastHost() {
  const toasts = useToasts((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4" style={{ top: 'calc(var(--safe-top) + 8px)' }}>
      {toasts.map((t) => (
        <div key={t.id} className={clsx('pointer-events-auto max-w-md rounded-full px-4 py-2.5 text-[15px] font-medium shadow-float animate-pop-in', t.tone === 'error' ? 'bg-danger text-white' : 'glass text-fg')}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

/** يحوّل أي خطأ إلى رسالة مترجمة (AppError.messageKey من المشروع الأصلي أو رسالة عامة). */
export function errorText(error: unknown, t: (k: string, o?: Record<string, unknown>) => string): string {
  const e = error as { messageKey?: string; params?: Record<string, unknown>; message?: string }
  if (e?.messageKey) return t(e.messageKey, e.params)
  return e?.message && !/^errors\./.test(e.message) ? e.message : t('ios.common.error')
}
