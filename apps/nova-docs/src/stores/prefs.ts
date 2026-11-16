/** تفضيلات الجهاز (اللغة، المظهر، اللغات المفضلة لـ OCR) محفوظة في UserDefaults عبر @capacitor/preferences. */
import { Preferences } from '@capacitor/preferences'
import { create } from 'zustand'
import type { Language } from '@shared/settings'
import { detectLanguage, setLanguage } from '../i18n'
import type { OcrLanguage } from '../lib/ocrCore'

export type Theme = 'system' | 'light' | 'dark'

interface Prefs {
  language: Language
  theme: Theme
  ocrLanguages: OcrLanguage[]
  signatures: string[]          // PNG data URLs (أقصى 4)
  appLock: boolean              // قفل التطبيق بـ Face ID / Touch ID / رمز الجهاز
  /** عرض الصفحات بمحرك iOS (PDFKit) بدل pdf.js — افتراضي على iPhone/iPad */
  nativeRender: boolean
  loaded: boolean
  load(): Promise<void>
  setLanguage(l: Language): Promise<void>
  setTheme(t: Theme): void
  setOcrLanguages(l: OcrLanguage[]): void
  addSignature(dataUrl: string): void
  removeSignature(index: number): void
  setAppLock(on: boolean): void
  setNativeRender(on: boolean): void
}

const KEY = 'nova.prefs.v1'

async function persist(p: Pick<Prefs, 'language' | 'theme' | 'ocrLanguages' | 'signatures' | 'appLock' | 'nativeRender'>) {
  await Preferences.set({ key: KEY, value: JSON.stringify(p) }).catch(() => undefined)
}

export const usePrefs = create<Prefs>((set, get) => ({
  language: detectLanguage(),
  theme: 'system',
  ocrLanguages: ['ara', 'fra', 'eng'],
  signatures: [],
  appLock: false,
  nativeRender: true,
  loaded: false,
  async load() {
    try {
      const { value } = await Preferences.get({ key: KEY })
      if (value) {
        const saved = JSON.parse(value) as Partial<Prefs>
        set({
          language: saved.language ?? get().language,
          theme: saved.theme ?? 'system',
          ocrLanguages: saved.ocrLanguages?.length ? saved.ocrLanguages : get().ocrLanguages,
          signatures: Array.isArray(saved.signatures) ? saved.signatures.slice(0, 4) : [],
          appLock: saved.appLock === true,
          nativeRender: saved.nativeRender !== false
        })
      }
    } catch {
      /* ignore */
    }
    set({ loaded: true })
  },
  async setLanguage(language) {
    set({ language })
    await setLanguage(language)
    void persist(snapshot())
  },
  setTheme(theme) {
    set({ theme })
    applyTheme(theme)
    void persist(snapshot())
  },
  setOcrLanguages(ocrLanguages) {
    set({ ocrLanguages: ocrLanguages.length ? ocrLanguages : ['ara'] })
    void persist(snapshot())
  },
  addSignature(dataUrl) {
    set({ signatures: [dataUrl, ...get().signatures].slice(0, 4) })
    void persist(snapshot())
  },
  removeSignature(index) {
    set({ signatures: get().signatures.filter((_, i) => i !== index) })
    void persist(snapshot())
  },
  setAppLock(appLock) {
    set({ appLock })
    void persist(snapshot())
  },
  setNativeRender(nativeRender) {
    set({ nativeRender })
    void persist(snapshot())
  }
}))

function snapshot() {
  const { language, theme, ocrLanguages, signatures, appLock, nativeRender } = usePrefs.getState()
  return { language, theme, ocrLanguages, signatures, appLock, nativeRender }
}

export function applyTheme(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#09110F' : '#F5F7F6')
}
