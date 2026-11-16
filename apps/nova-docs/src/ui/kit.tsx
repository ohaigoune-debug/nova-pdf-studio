/**
 * مكونات واجهة بأسلوب iOS: شريط تنقل بعنوان كبير، قوائم مجمّعة، أزرار، مفاتيح، حقول، تحكم مجزأ.
 * مصممة للّمس (أهداف ≥ 44 نقطة) وتدعم RTL والوضع الداكن.
 */
import clsx from 'clsx'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { type ButtonHTMLAttributes, type ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export function useIsRtl(): boolean {
  const { i18n } = useTranslation()
  return i18n.dir() === 'rtl'
}

/** سهم «رجوع/التالي» يتبع اتجاه اللغة. */
export function Chevron({ back = false, className }: { back?: boolean; className?: string }) {
  const rtl = useIsRtl()
  const Icon = back !== rtl ? ChevronLeft : ChevronRight
  return <Icon className={clsx('h-5 w-5', className)} strokeWidth={2.4} />
}

export function NavBar({ title, large = false, onBack, backLabel, leading, trailing, subtitle, children }: {
  title?: ReactNode
  large?: boolean
  onBack?: () => void
  backLabel?: string
  leading?: ReactNode
  trailing?: ReactNode
  subtitle?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="glass sticky top-0 z-20 border-b hairline" style={{ paddingTop: 'var(--safe-top)' }}>
      <div className="flex h-11 items-center gap-1 px-2">
        <div className="flex min-w-[72px] items-center">
          {onBack ? (
            <button onClick={onBack} data-testid="nav-back" className="pressable flex h-11 items-center gap-0.5 px-1 text-accent" aria-label={backLabel ?? "Back"}>
              <Chevron back />
              {backLabel && <span className="max-w-[110px] truncate text-[17px]">{backLabel}</span>}
            </button>
          ) : leading}
        </div>
        <div className={clsx('flex-1 truncate text-center text-[17px] font-semibold', large && 'opacity-0')}>{title}</div>
        <div className="flex min-w-[72px] items-center justify-end gap-1">{trailing}</div>
      </div>
      {large && (
        <div className="px-4 pb-2">
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-brand">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[15px] text-muted">{subtitle}</p>}
        </div>
      )}
      {children}
    </header>
  )
}

export function IconButton({ label, children, className, active, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button aria-label={label} title={label} className={clsx('pressable grid h-11 min-w-11 place-items-center rounded-full px-2 text-accent disabled:opacity-35', active && 'bg-accent/15', className)} {...rest}>
      {children}
    </button>
  )
}

export function Button({ variant = 'filled', size = 'md', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'filled' | 'tinted' | 'plain' | 'danger' | 'brand'; size?: 'md' | 'lg' | 'sm' }) {
  return (
    <button
      className={clsx(
        'pressable inline-flex items-center justify-center gap-2 rounded-ios font-semibold disabled:opacity-40',
        size === 'lg' ? 'h-[52px] px-6 text-[17px]' : size === 'sm' ? 'h-9 px-3 text-[15px]' : 'h-11 px-4 text-[17px]',
        variant === 'filled' && 'bg-accent text-accent-fg',
        variant === 'brand' && 'bg-brand text-white dark:text-[#0B1513]',
        variant === 'tinted' && 'bg-accent/15 text-accent',
        variant === 'plain' && 'text-accent',
        variant === 'danger' && 'bg-danger/12 text-danger',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Section({ header, footer, children, className }: { header?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('mx-4 mb-6', className)}>
      {header && <div className="px-4 pb-1.5 text-[13px] uppercase tracking-wide text-muted">{header}</div>}
      <div className="overflow-hidden rounded-ios bg-surface">{children}</div>
      {footer && <div className="px-4 pt-1.5 text-[13px] text-muted">{footer}</div>}
    </section>
  )
}

export function Row({ icon, iconBg, title, subtitle, detail, onClick, chevron, trailing, destructive, className, disabled }: {
  icon?: ReactNode
  iconBg?: string
  title: ReactNode
  subtitle?: ReactNode
  detail?: ReactNode
  onClick?: () => void
  chevron?: boolean
  trailing?: ReactNode
  destructive?: boolean
  className?: string
  disabled?: boolean
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp onClick={disabled ? undefined : onClick} className={clsx('flex min-h-[48px] w-full items-center gap-3 ps-4 text-start', onClick && !disabled && 'pressable active:bg-surface-2', disabled && 'opacity-45', className)}>
      {icon && <span className={clsx('grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px] text-white', iconBg ?? 'bg-accent')}>{icon}</span>}
      <span className="flex min-h-[48px] flex-1 items-center gap-2 border-b hairline py-2 pe-4 [*:last-child>&]:border-0">
        <span className="min-w-0 flex-1">
          <span className={clsx('block truncate text-[17px]', destructive && 'text-danger')}>{title}</span>
          {subtitle && <span className="block truncate text-[13px] text-muted">{subtitle}</span>}
        </span>
        {detail && <span className="shrink-0 text-[15px] text-muted tabular">{detail}</span>}
        {trailing}
        {chevron && <Chevron className="h-4 w-4 shrink-0 text-muted/60" />}
      </span>
    </Comp>
  )
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx('relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors disabled:opacity-40', checked ? 'bg-accent' : 'bg-surface-2 dark:bg-[#3a4a46]')}
    >
      <span className={clsx('absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-all', checked ? 'start-[22px]' : 'start-[2px]')} />
    </button>
  )
}

export function Segmented<T extends string>({ value, options, onChange, className }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={clsx('flex rounded-[9px] bg-surface-2 p-[2px]', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx('h-8 flex-1 truncate rounded-[7px] px-2 text-[13px] font-semibold transition-all', value === o.value ? 'bg-surface text-fg shadow-sm dark:bg-[#3a4a46]' : 'text-muted')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function SearchField({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
  return (
    <label className="mx-4 mb-2 flex h-9 items-center gap-2 rounded-[10px] bg-surface-2 px-2.5 text-muted">
      <Search className="h-4 w-4 shrink-0" />
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-[17px] text-fg outline-none placeholder:text-muted"
        enterKeyHint="search"
      />
      {value && (
        <button onClick={() => onChange('')} aria-label="Clear" className="grid h-5 w-5 place-items-center rounded-full bg-muted/40 text-white">
          <X className="h-3 w-3" />
        </button>
      )}
    </label>
  )
}

export function Field({ label, value, onChange, type = 'text', placeholder, inputMode, dir, multiline }: {
  label: ReactNode
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  inputMode?: 'decimal' | 'numeric' | 'text' | 'email' | 'tel'
  dir?: 'ltr' | 'rtl' | 'auto'
  multiline?: boolean
}) {
  return (
    <label className="flex min-h-[48px] items-center gap-3 border-b hairline ps-4 pe-4 last:border-0">
      <span className="w-[38%] shrink-0 text-[15px] text-muted">{label}</span>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} dir={dir} rows={3} className="min-w-0 flex-1 resize-none bg-transparent py-3 text-[17px] outline-none" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} type={type} placeholder={placeholder} inputMode={inputMode} dir={dir} className="h-12 min-w-0 flex-1 bg-transparent text-[17px] outline-none" />
      )}
    </label>
  )
}

export function Empty({ icon, title, desc, action }: { icon: ReactNode; title: ReactNode; desc?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center animate-fade-in">
      <div className="mb-4 grid h-20 w-20 place-items-center rounded-[22px] bg-accent/12 text-accent">{icon}</div>
      <h2 className="text-[20px] font-semibold">{title}</h2>
      {desc && <p className="mt-1.5 max-w-sm text-[15px] text-muted">{desc}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function ProBadge({ className }: { className?: string }) {
  return <span className={clsx('rounded-[5px] bg-gradient-to-br from-[#17B890] to-[#123D36] px-1.5 py-[1px] text-[10px] font-bold tracking-wider text-white', className)}>PRO</span>
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx('inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent', className)} />
}

/** قياس عرض عنصر (لتكييف تصيير صفحات PDF مع حجم الشاشة). */
export function useElementWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatch(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}
