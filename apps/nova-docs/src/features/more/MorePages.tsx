/** صفحات «المزيد»: الإعدادات، ملف المؤسسة وأصول الهوية، اللغة، النسخ الاحتياطي، الدعم، الخصوصية/الشروط، حول. */
import { Check, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES, type CompanyProfile } from '@shared/settings'
import { getSettings, updateSettings } from '@modules/settings/main/repository'
import { clearDemoData, demoStatus, loadDemoData } from '@modules/database/main/demo-data'
import { getDatabase, replaceDatabase } from '../../platform/shims/database-main'
import type { Route } from '../../stores/nav'
import { useNav } from '../../stores/nav'
import { usePrefs, type Theme } from '../../stores/prefs'
import { usePro } from '../../stores/proInstance'
import { brandAsset, setBrandAsset, type BrandKind } from '../../lib/invoicing'
import { legalDoc } from '../../lib/legal'
import { SUPPORT_EMAIL, useAppVersion } from '../../lib/version'
import { pickFilesBytes, shareBytes } from '../../lib/docs'
import { bytesToBase64 } from '../../platform/bytes'
import { NovaLock } from '../../platform/native'
import { LogoMark } from '../../brand/Logo'
import { Button, Field, NavBar, Row, Section, Segmented, Toggle } from '../../ui/kit'
import { confirmDialog, errorText, toast } from '../../ui/overlays'
import { WithDatabase } from '../invoices/shared'
import { normalizeImages } from '../scan/images'
import { SellerFields } from '../invoices/Seller'
import { CurrencySelect } from '../invoices/CurrencySelect'

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = useTranslation()
  const pop = useNav((s) => s.pop)
  return (
    <div className="flex h-full flex-col">
      <NavBar title={title} onBack={pop} backLabel={t('ios.more.title')} />
      <div className="ios-scroll min-h-0 flex-1 pt-4 pb-10">{children}</div>
    </div>
  )
}

function SettingsPage() {
  const { t } = useTranslation()
  const { theme, setTheme } = usePrefs()
  const push = useNav((s) => s.push)
  const [currency, setCurrency] = useState(getSettings().invoice.defaultCurrency)
  const [demo, setDemo] = useState(demoStatus().loaded)
  return (
    <Page title={t('ios.more.settings')}>
      <Section header={t('ios.settings.appearance')}>
        <div className="p-3"><Segmented value={theme} onChange={(v: Theme) => setTheme(v)} options={[{ value: 'system', label: t('ios.settings.system') }, { value: 'light', label: t('ios.settings.light') }, { value: 'dark', label: t('ios.settings.dark') }]} /></div>
      </Section>
      <LockSection />
      <Section header={t('ios.tabs.invoices')} footer={t('ios.settings.companyHint')}>
        <Row title={t('ios.settings.company')} chevron onClick={() => push({ name: 'company' })} />
        <label className="flex min-h-[48px] items-center gap-3 px-4">
          <span className="flex-1 text-[17px]">{t('ios.settings.defaultCurrency')}</span>
          <CurrencySelect value={currency} onChange={(code) => { setCurrency(code); const s = getSettings(); updateSettings({ invoice: { ...s.invoice, defaultCurrency: code } }) }} className="h-12 max-w-[55%] bg-transparent text-end text-[17px] text-muted outline-none" />
        </label>
      </Section>
      <Section header={t('ios.settings.demo')}>
        {demo
          ? <Row title={t('ios.settings.clearDemo')} destructive onClick={() => { clearDemoData(); setDemo(false); toast(t('ios.common.done')) }} />
          : <Row title={t('ios.settings.loadDemo')} onClick={() => { loadDemoData(); setDemo(true); toast(t('ios.common.done')) }} />}
      </Section>
    </Page>
  )
}

function LockSection() {
  const { t } = useTranslation()
  const { appLock, setAppLock } = usePrefs()
  const [status, setStatus] = useState<{ available: boolean; biometry: string } | null>(null)
  useEffect(() => {
    void NovaLock.status().then(setStatus).catch(() => setStatus({ available: false, biometry: 'none' }))
  }, [])
  if (!status) return null
  const method = status.biometry === 'faceID' ? 'Face ID' : status.biometry === 'touchID' ? 'Touch ID' : status.biometry === 'opticID' ? 'Optic ID' : t('ios.lock.passcode')
  const toggle = async (on: boolean) => {
    if (!on) return setAppLock(false)
    try {
      // تفعيل القفل يتطلب إثبات الهوية أولًا
      await NovaLock.authenticate({ reason: t('ios.lock.reason') })
      setAppLock(true)
    } catch (e) {
      if ((e as { code?: string })?.code === 'UNAVAILABLE') toast(t('ios.lock.unavailable'), 'info')
    }
  }
  return (
    <Section header={t('ios.lock.section')} footer={!status.available ? t('ios.lock.unavailable') : status.biometry === 'none' ? t('ios.lock.settingDescPasscode') : t('ios.lock.settingDesc', { method })}>
      <label className="flex min-h-[48px] items-center gap-3 px-4">
        <span className="flex-1 text-[17px]">{t('ios.lock.setting', { method })}</span>
        <Toggle checked={appLock} disabled={!status.available} onChange={(v) => void toggle(v)} label={t('ios.lock.setting', { method })} />
      </label>
    </Section>
  )
}

function CompanyPage() {
  const { t } = useTranslation()
  const [c, setC] = useState<CompanyProfile>(getSettings().company)
  const [assets, setAssets] = useState<Record<BrandKind, string | null>>({ logo: brandAsset('logo'), signature: brandAsset('signature'), stamp: brandAsset('stamp') })
  const f = (k: keyof CompanyProfile) => (v: string) => setC((s) => ({ ...s, [k]: v }))
  const save = () => {
    updateSettings({ company: c })
    toast(t('ios.viewer.saved'))
  }
  const pick = async (kind: BrandKind) => {
    const [img] = await pickFilesBytes(['image'], false)
    if (!img) return
    const [n] = await normalizeImages([img.bytes], 900)
    const url = `data:image/jpeg;base64,${bytesToBase64(n.bytes)}`
    setBrandAsset(kind, url)
    setAssets((a) => ({ ...a, [kind]: url }))
  }
  return (
    <Page title={t('ios.settings.company')}>
      <SellerFields c={c} set={f} />
      <Section header={t('ios.settings.brand')}>
        {(['logo', 'signature', 'stamp'] as BrandKind[]).map((k) => (
          <Row key={k} title={t(`ios.settings.${k}`)} trailing={assets[k] ? <img src={assets[k]!} alt="" className="h-9 w-14 rounded bg-white object-contain" /> : undefined}
            onClick={() => void pick(k)} subtitle={assets[k] ? undefined : t('ios.settings.choose')} />
        ))}
        {(assets.logo || assets.signature || assets.stamp) && (
          <Row title={t('ios.settings.remove')} destructive onClick={() => { (['logo', 'signature', 'stamp'] as BrandKind[]).forEach((k) => setBrandAsset(k, null)); setAssets({ logo: null, signature: null, stamp: null }) }} />
        )}
      </Section>
      <div className="px-4"><Button className="w-full" onClick={save}>{t('common.save')}</Button></div>
    </Page>
  )
}

function LanguagesPage() {
  const { t } = useTranslation()
  const { language, setLanguage } = usePrefs()
  return (
    <Page title={t('ios.more.languages')}>
      <Section>
        {LANGUAGES.map((l) => (
          <Row key={l.code} title={l.label} subtitle={l.dir === 'rtl' ? 'RTL' : undefined} onClick={() => void setLanguage(l.code)} trailing={language === l.code ? <Check className="h-5 w-5 text-accent" /> : undefined} />
        ))}
      </Section>
    </Page>
  )
}

const BACKUP_MAGIC = 'SQLite format 3'

function BackupPage() {
  const { t } = useTranslation()
  const exportBackup = async () => {
    if (!usePro.getState().require('backup')) return
    const db = getDatabase()
    await db.flush()
    const date = new Date().toISOString().slice(0, 10)
    await shareBytes(`NOVA-Docs-Backup-${date}.novabackup`, db.exportBytes())
    toast(t('ios.backup.exported'))
  }
  const importBackup = async () => {
    if (!usePro.getState().require('backup')) return
    const [file] = await pickFilesBytes(['backup'], false)
    if (!file) return
    if (new TextDecoder().decode(file.bytes.slice(0, 15)) !== BACKUP_MAGIC) {
      toast(t('ios.backup.invalid'), 'error')
      return
    }
    if (!(await confirmDialog(t('ios.backup.confirmImport'), { destructive: true }))) return
    try {
      replaceDatabase(file.bytes)
      await getDatabase().flush()
      toast(t('ios.backup.imported'))
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
  }
  return (
    <Page title={t('ios.backup.title')}>
      <p className="px-8 pb-4 text-[14px] text-muted">{t('ios.backup.desc')}</p>
      <Section>
        <Row title={t('ios.backup.export')} onClick={() => void exportBackup()} />
        <Row title={t('ios.backup.import')} onClick={() => void importBackup()} />
      </Section>
    </Page>
  )
}

function SupportPage() {
  const { t } = useTranslation()
  const version = useAppVersion()
  return (
    <Page title={t('ios.support.title')}>
      <p className="px-8 pb-4 text-[14px] text-muted">{t('ios.support.desc')}</p>
      {SUPPORT_EMAIL && <Section><Row icon={<Mail className="h-4 w-4" />} title={t('ios.support.email')} detail={SUPPORT_EMAIL} onClick={() => window.open(`mailto:${SUPPORT_EMAIL}?subject=NOVA%20Docs%20${encodeURIComponent(version)}`)} /></Section>}
      <Section><div className="space-y-3 p-4 text-[15px]"><p>{t('ios.support.faqOffline')}</p><p>{t('ios.support.faqPrivacy')}</p></div></Section>
    </Page>
  )
}

function LegalPage({ doc }: { doc: 'privacy' | 'terms' }) {
  const language = usePrefs((s) => s.language)
  const d = legalDoc(doc, language)
  return (
    <Page title={d.title}>
      <div className="mx-4 space-y-3 rounded-ios bg-surface p-5 text-[15px] leading-relaxed">{d.body.map((p, i) => <p key={i}>{p}</p>)}</div>
    </Page>
  )
}

function AboutPage() {
  const { t } = useTranslation()
  const version = useAppVersion()
  return (
    <Page title={t('ios.more.about')}>
      <div className="flex flex-col items-center px-8 text-center">
        <LogoMark size={96} />
        <h2 className="mt-4 text-[24px] font-bold text-brand">NOVA Docs: PDF & Invoices</h2>
        <p className="text-muted">{t('ios.brand.tagline')}</p>
        <p className="mt-2 text-[13px] text-muted">{t('ios.more.version', { v: version })}</p>
        <p className="mt-6 text-[13px] text-muted">pdf.js · pdf-lib · Tesseract.js · SQLite (sql.js) · SheetJS · Capacitor</p>
      </div>
    </Page>
  )
}

export default function MorePages({ route }: { route: Route }) {
  switch (route.name) {
    case 'settings': return <WithDatabase>{() => <SettingsPage />}</WithDatabase>
    case 'company': return <WithDatabase>{() => <CompanyPage />}</WithDatabase>
    case 'languages': return <LanguagesPage />
    case 'backup': return <WithDatabase>{() => <BackupPage />}</WithDatabase>
    case 'support': return <SupportPage />
    case 'legal': return <LegalPage doc={route.doc} />
    case 'about': return <AboutPage />
    default: return null
  }
}
