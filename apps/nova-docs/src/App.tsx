/**
 * هيكل التطبيق: خمسة أقسام (المستندات، أدوات PDF، المسح، الفواتير، المزيد).
 * آيفون: شريط تبويب سفلي. آيباد/الشاشات العريضة: شريط جانبي دائم بأسلوب iPadOS.
 */
import clsx from 'clsx'
import { FileText, Grid2x2, MoreHorizontal, ReceiptText, ScanLine } from 'lucide-react'
import { type ReactNode, Suspense, lazy, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { App as CapApp } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { TABS, type Route, type Tab, useNav } from './stores/nav'
import { usePrefs, applyTheme } from './stores/prefs'
import { usePro } from './stores/proInstance'
import { useLibrary } from './stores/library'
import { DialogHost, ToastHost, toast } from './ui/overlays'
import { Spinner, useMediaQuery } from './ui/kit'
import { LogoMark } from './brand/Logo'
import { Paywall } from './features/Paywall'
import { DocumentsScreen } from './features/documents/DocumentsScreen'
import { NovaDocuments } from './platform/native'
import { importIntoLibrary } from './lib/docs'
import { handleDeepLink } from './lib/deeplinks'

const ViewerScreen = lazy(() => import('./features/viewer/ViewerScreen'))
const ToolsScreen = lazy(() => import('./features/tools/ToolsScreen'))
const ScanScreen = lazy(() => import('./features/scan/ScanScreen'))
const InvoicesScreen = lazy(() => import('./features/invoices/InvoicesScreen'))
const InvoiceEditor = lazy(() => import('./features/invoices/InvoiceEditor'))
const InvoiceView = lazy(() => import('./features/invoices/InvoiceView'))
const CustomerEditor = lazy(() => import('./features/invoices/CustomerEditor'))
const ProductEditor = lazy(() => import('./features/invoices/ProductEditor'))
const MoreScreen = lazy(() => import('./features/more/MoreScreen'))
const MorePages = lazy(() => import('./features/more/MorePages'))
const SheetsScreen = lazy(() => import('./features/sheets/SheetsScreen'))
const SheetEditor = lazy(() => import('./features/sheets/SheetEditor'))

const ICONS: Record<Tab, ReactNode> = {
  documents: <FileText className="h-[24px] w-[24px]" />,
  tools: <Grid2x2 className="h-[24px] w-[24px]" />,
  scan: <ScanLine className="h-[24px] w-[24px]" />,
  invoices: <ReceiptText className="h-[24px] w-[24px]" />,
  more: <MoreHorizontal className="h-[24px] w-[24px]" />
}

function RouteView({ route }: { route: Route }) {
  switch (route.name) {
    case 'viewer': return <ViewerScreen file={route.file} startPage={route.page} startEditing={route.edit} />
    case 'invoiceEdit': return <InvoiceEditor id={route.id} prefill={route.prefill} />
    case 'invoiceView': return <InvoiceView id={route.id} />
    case 'customerEdit': return <CustomerEditor id={route.id} />
    case 'productEdit': return <ProductEditor id={route.id} />
    case 'sheets': return <SheetsScreen />
    case 'sheet': return <SheetEditor id={route.id} />
    default: return <MorePages route={route} />
  }
}

function RootView({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'documents': return <DocumentsScreen />
    case 'tools': return <ToolsScreen />
    case 'scan': return <ScanScreen />
    case 'invoices': return <InvoicesScreen />
    case 'more': return <MoreScreen />
  }
}

function Loading() {
  return <div className="grid h-full place-items-center text-muted"><Spinner /></div>
}

export default function App() {
  const { t } = useTranslation()
  const { tab, stacks, setTab } = useNav()
  const theme = usePrefs((s) => s.theme)
  const wide = useMediaQuery('(min-width: 820px)')
  const top = stacks[tab].at(-1)
  const fullScreen = top?.name === 'viewer' || top?.name === 'sheet'

  useEffect(() => {
    applyTheme(theme)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => applyTheme(usePrefs.getState().theme)
    mq.addEventListener('change', on)
    const dark = document.documentElement.classList.contains('dark')
    void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined)
    return () => mq.removeEventListener('change', on)
  }, [theme])

  useEffect(() => {
    void usePro.getState().init()
    void SplashScreen.hide().catch(() => undefined)
    // «فتح في NOVA Docs» من تطبيق الملفات أو Mail أو Safari
    const sub = CapApp.addListener('appUrlOpen', async ({ url }) => {
      if (url.startsWith('novadocs://')) {
        await handleDeepLink(url)
        return
      }
      if (!url.startsWith('file:')) return
      try {
        const file = await NovaDocuments.importUrl({ url })
        const [name] = await importIntoLibrary([file])
        await useLibrary.getState().refresh()
        useNav.getState().push({ name: 'viewer', file: name }, 'documents')
      } catch {
        toast(t('ios.viewer.openFailed'), 'error')
      }
    })
    const back = CapApp.addListener('backButton', () => useNav.getState().pop())
    return () => {
      void sub.then((h) => h.remove())
      void back.then((h) => h.remove())
    }
  }, [t])

  const content = (
    <main className="relative h-full min-w-0 flex-1 overflow-hidden">
      <Suspense fallback={<Loading />}>
        {top ? (
          <div key={`${tab}-${stacks[tab].length}`} className="absolute inset-0 animate-push-in bg-bg">
            <RouteView route={top} />
          </div>
        ) : (
          <div key={tab} className="absolute inset-0 animate-fade-in">
            <RootView tab={tab} />
          </div>
        )}
      </Suspense>
    </main>
  )

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}>
      {wide && !fullScreen && (
        <nav className="flex w-[264px] shrink-0 flex-col border-e hairline bg-surface/60" style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}>
          <div className="mb-5 flex items-center gap-3 px-5">
            <LogoMark size={40} />
            <div>
              <div className="text-[19px] font-bold text-brand">NOVA Docs</div>
              <div className="text-[12px] text-muted">{t('ios.brand.tagline')}</div>
            </div>
          </div>
          {TABS.map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={clsx('mx-3 mb-1 flex h-11 items-center gap-3 rounded-[10px] px-3 text-[17px] transition-colors', tab === id ? 'bg-accent text-accent-fg font-semibold' : 'text-fg hover:bg-surface-2')}
            >
              <span className={tab === id ? '' : 'text-accent'}>{ICONS[id]}</span>
              {t(`ios.tabs.${id}`)}
            </button>
          ))}
        </nav>
      )}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        {content}
        {!wide && !fullScreen && (
          <nav className="glass flex shrink-0 border-t hairline" style={{ paddingBottom: 'var(--safe-bottom)' }}>
            {TABS.map((id) => (
              <button key={id} onClick={() => setTab(id)} className={clsx('flex h-[var(--tabbar-h)] flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium', tab === id ? 'text-accent' : 'text-muted')} aria-current={tab === id}>
                {ICONS[id]}
                <span>{t(`ios.tabs.${id}`)}</span>
              </button>
            ))}
          </nav>
        )}
      </div>
      <Paywall />
      <DialogHost />
      <ToastHost />
    </div>
  )
}
