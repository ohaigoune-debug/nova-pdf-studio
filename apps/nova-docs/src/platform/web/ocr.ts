import { WebPlugin } from '@capacitor/core'
import type { NativeOcrResult, NovaOcrPlugin } from '../native'

/** لا يوجد Apple Vision في المتصفح: التطبيق ينتقل تلقائيًا إلى Tesseract المضمّن. */
export class WebOcr extends WebPlugin implements Omit<NovaOcrPlugin, 'addListener'> {
  async supportedLanguages() {
    return { languages: [] as string[], revision: 0 }
  }
  async recognize(): Promise<NativeOcrResult> {
    throw this.unavailable('Apple Vision OCR is only available on iOS.')
  }
}
