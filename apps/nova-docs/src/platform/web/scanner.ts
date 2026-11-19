import { blobOf } from '../bytes'
import { WebPlugin } from '@capacitor/core'
import type { NovaScannerPlugin, ScannedPage } from '../native'
import { pickWebFiles } from './pick'

/** في المتصفح: لا يوجد VisionKit؛ نستخدم كاميرا/صور المتصفح دون كشف حدود تلقائي. */
export class WebScanner extends WebPlugin implements Omit<NovaScannerPlugin, 'addListener'> {
  async isSupported() {
    return { supported: false }
  }
  async scan() {
    const files = await pickWebFiles('image/*', true, 'environment')
    const pages: ScannedPage[] = []
    for (const f of files) {
      const img = await createImageBitmap(blobOf(f.bytes, f.mimeType))
      pages.push({ path: f.url, webPath: f.url, width: img.width, height: img.height })
      img.close()
    }
    return { pages, cancelled: pages.length === 0 }
  }
}
