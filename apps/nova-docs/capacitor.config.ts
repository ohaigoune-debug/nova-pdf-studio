import type { CapacitorConfig } from '@capacitor/cli'

// Bundle ID مستقل تمامًا عن تطبيق «مدرسة». يمكن تغييره قبل التسجيل في Apple Developer إن كان محجوزًا.
const config: CapacitorConfig = {
  appId: 'com.haigoune.novadocs',
  appName: 'NOVA Docs',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    scheme: 'NOVA Docs',
    backgroundColor: '#123D36',
    limitsNavigationsToAppBoundDomains: true,
    preferredContentMode: 'mobile'
  },
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: '#123D36', showSpinner: false, launchAutoHide: true },
    Keyboard: { resize: 'native' }
  }
}

export default config
