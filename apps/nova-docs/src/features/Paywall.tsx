/** شاشة الترقية إلى NOVA Pro — شراء لمرة واحدة عبر Apple (StoreKit 2) بالسعر المحلي القادم من App Store. */
import { Check, FileSignature, Files, Grid3x3, Lock, ReceiptText, ScanText, ShieldCheck, Wand2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePro } from '../stores/proInstance'
import { Button, Spinner } from '../ui/kit'
import { Sheet, toast } from '../ui/overlays'
import { LogoMark } from '../brand/Logo'

export function Paywall() {
  const { t } = useTranslation()
  const { paywallFor, closePaywall, product, purchase, restore, busy, isPro, canMakePayments, lastStatus, error } = usePro()
  const open = paywallFor !== null && !isPro
  const features = [
    { icon: <FileSignature className="h-5 w-5" />, text: t('ios.pro.f1') },
    { icon: <ScanText className="h-5 w-5" />, text: t('ios.pro.f2') },
    { icon: <ReceiptText className="h-5 w-5" />, text: t('ios.pro.f3') },
    { icon: <Files className="h-5 w-5" />, text: t('ios.pro.f4') },
    { icon: <Grid3x3 className="h-5 w-5" />, text: t('ios.pro.f5') },
    { icon: <ShieldCheck className="h-5 w-5" />, text: t('ios.pro.f6') }
  ]
  const onBuy = async () => {
    const status = await purchase()
    if (status === 'purchased') toast(t('ios.pro.thanks'))
    else if (status === 'pending') toast(t('ios.pro.pending'), 'info')
    else if (status === 'error' || status === 'unverified') toast(t('ios.pro.failed'), 'error')
  }
  const onRestore = async () => {
    const ok = await restore()
    toast(ok ? t('ios.more.restored') : t('ios.more.nothingToRestore'), ok ? 'ok' : 'info')
  }
  return (
    <Sheet open={open} onClose={closePaywall} full trailing={<button onClick={closePaywall} className="text-[17px] text-accent">{t('common.close')}</button>}>
      <div className="flex flex-col items-center px-6 pt-2 text-center">
        <LogoMark size={84} />
        <h2 className="mt-4 text-[30px] font-bold tracking-tight text-brand">{t('ios.pro.title')}</h2>
        <p className="mt-1 text-[17px] text-muted">{t('ios.pro.subtitle')}</p>
        {paywallFor && paywallFor !== 'editText' && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent/12 px-3 py-1 text-[13px] font-medium text-accent">
            <Lock className="h-3.5 w-3.5" /> {t('ios.pro.lockedFeature')}
          </p>
        )}
      </div>
      <ul className="mx-6 mt-6 space-y-3.5">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-3 text-start">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-accent/12 text-accent">{f.icon}</span>
            <span className="text-[16px] leading-snug">{f.text}</span>
          </li>
        ))}
      </ul>
      <div className="mx-6 mt-8 space-y-3">
        {!canMakePayments && <p className="rounded-ios bg-warning/15 p-3 text-[14px]">{t('ios.pro.paymentsDisabled')}</p>}
        {lastStatus === 'pending' && <p className="rounded-ios bg-accent/12 p-3 text-[14px]">{t('ios.pro.pending')}</p>}
        <Button size="lg" className="w-full" disabled={!!busy || !canMakePayments || !product} onClick={() => void onBuy()}>
          {busy === 'purchase' ? <Spinner /> : product ? t('ios.pro.buy', { price: product.displayPrice }) : t('ios.pro.loadingPrice')}
        </Button>
        <p className="text-center text-[13px] text-muted">{t('ios.pro.lifetime')}</p>
        <Button variant="plain" className="w-full" disabled={!!busy} onClick={() => void onRestore()}>
          {busy === 'restore' ? <Spinner /> : t('ios.more.restore')}
        </Button>
        {error && !product && <p className="text-center text-[13px] text-danger">{t('ios.pro.unavailable')}</p>}
        <p className="flex items-center justify-center gap-1 pb-4 text-center text-[12px] text-muted"><Check className="h-3.5 w-3.5" />{t('ios.pro.legal')}</p>
      </div>
      <Wand2 className="hidden" />
    </Sheet>
  )
}
