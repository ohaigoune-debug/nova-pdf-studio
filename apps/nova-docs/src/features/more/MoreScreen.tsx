/** قسم «المزيد»: NOVA Pro واستعادة المشتريات، الجداول، الإعدادات، اللغة، النسخ الاحتياطي، الدعم. */
import { BadgeCheck, CircleHelp, DatabaseBackup, FileSpreadsheet, Info, Languages, RotateCcw, Settings, Shield, ScrollText, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '@shared/settings'
import { usePro } from '../../stores/proInstance'
import { useNav } from '../../stores/nav'
import { usePrefs } from '../../stores/prefs'
import { NovaStore } from '../../platform/native'
import { LogoMark } from '../../brand/Logo'
import { NavBar, ProBadge, Row, Section, Spinner } from '../../ui/kit'
import { errorText, toast } from '../../ui/overlays'
import { APP_VERSION } from '../../lib/version'

export default function MoreScreen() {
  const { t } = useTranslation()
  const { isPro, tester, product, busy, restore, openPaywall } = usePro()
  const push = useNav((s) => s.push)
  const language = usePrefs((s) => s.language)
  const onRestore = async () => {
    const ok = await restore()
    toast(ok ? t('ios.more.restored') : t('ios.more.nothingToRestore'), ok ? 'ok' : 'info')
  }
  return (
    <div className="ios-scroll h-full pb-10">
      <NavBar title={t('ios.more.title')} large />
      {tester && <div role="status" className="mx-4 mb-3 rounded-[12px] border border-[#F5C518]/50 bg-[#F5C518]/15 px-4 py-3 text-[14px] font-medium text-[#8a6d00] dark:text-[#F5C518]">{t('ios.pro.testerBuild')}</div>}
      <div className="mx-4 mb-6 mt-2 overflow-hidden rounded-card bg-gradient-to-br from-[#123D36] to-[#0B2621] p-5 text-white shadow-card">
        <div className="flex items-center gap-3">
          <LogoMark size={52} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[20px] font-bold">NOVA Pro {isPro && <BadgeCheck className="h-5 w-5 text-[#2FD3A8]" />}</div>
            <div className="text-[13px] text-white/70">{isPro ? t('ios.more.proActiveDesc') : t('ios.more.upgradeDesc')}</div>
          </div>
        </div>
        {!isPro && (
          <button onClick={() => openPaywall(null)} className="pressable mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-ios bg-[#17B890] font-semibold">
            <Sparkles className="h-5 w-5" />{product ? t('ios.pro.buy', { price: product.displayPrice }) : t('ios.more.upgrade')}
          </button>
        )}
      </div>
      <Section>
        <Row icon={busy === 'restore' ? <Spinner className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />} iconBg="bg-[#2F80ED]" title={t('ios.more.restore')} onClick={() => void onRestore()} />
        {isPro && <Row icon={<ScrollText className="h-4 w-4" />} iconBg="bg-[#5F6F6B]" title={t('ios.more.refund')} onClick={() => void NovaStore.requestRefund().then((r) => r.status === 'submitted' && toast(t('ios.more.refundSubmitted'))).catch((e) => toast(errorText(e, t), 'error'))} />}
      </Section>
      <Section>
        <Row icon={<FileSpreadsheet className="h-4 w-4" />} iconBg="bg-[#17B890]" title={t('ios.more.spreadsheets')} trailing={!isPro ? <ProBadge /> : undefined} chevron onClick={() => (usePro.getState().require('spreadsheets') ? push({ name: 'sheets' }) : undefined)} />
        <Row icon={<Settings className="h-4 w-4" />} iconBg="bg-[#5F6F6B]" title={t('ios.more.settings')} chevron onClick={() => push({ name: 'settings' })} />
        <Row icon={<Languages className="h-4 w-4" />} iconBg="bg-[#6E56CF]" title={t('ios.more.languages')} detail={LANGUAGES.find((l) => l.code === language)?.label} chevron onClick={() => push({ name: 'languages' })} />
        <Row icon={<DatabaseBackup className="h-4 w-4" />} iconBg="bg-[#F5A524]" title={t('ios.more.backup')} chevron onClick={() => push({ name: 'backup' })} />
      </Section>
      <Section>
        <Row icon={<CircleHelp className="h-4 w-4" />} iconBg="bg-[#0091FF]" title={t('ios.more.support')} chevron onClick={() => push({ name: 'support' })} />
        <Row icon={<Shield className="h-4 w-4" />} iconBg="bg-[#123D36]" title={t('ios.more.privacy')} chevron onClick={() => push({ name: 'legal', doc: 'privacy' })} />
        <Row icon={<ScrollText className="h-4 w-4" />} iconBg="bg-[#123D36]" title={t('ios.more.terms')} chevron onClick={() => push({ name: 'legal', doc: 'terms' })} />
        <Row icon={<Info className="h-4 w-4" />} iconBg="bg-[#8E9A97]" title={t('ios.more.about')} detail={APP_VERSION} chevron onClick={() => push({ name: 'about' })} />
      </Section>
      <p className="px-8 text-center text-[12px] text-muted">NOVA Docs: PDF & Invoices · {t('ios.brand.tagline')}</p>
    </div>
  )
}
