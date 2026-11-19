/**
 * NOVA Docs (iOS) — بناء الواجهة بـ Vite.
 * يعيد استخدام الشيفرة المشتركة من المشروع الأصلي (src/shared و src/modules/*) دون نسخها،
 * ويستبدل طبقة Electron/Node بطبقة منصة متوافقة مع WKWebView (Capacitor):
 *   - @modules/database/main و ./sqlite  →  محرك sql.js يحفظ في Filesystem الجهاز
 *   - @main/logger                        →  مسجل خفيف في الواجهة
 */
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const repo = resolve(__dirname, '../..')
const shim = (name: string) => resolve(__dirname, 'src/platform/shims', name)

/** يحوّل استيرادات Node الخاصة بقاعدة البيانات إلى نسخ المتصفح، حتى الاستيرادات النسبية داخل الوحدات الأصلية. */
export function novaPlatformShims(): Plugin {
  const dbMain = resolve(repo, 'src/modules/database/main')
  const redirects: Record<string, string> = {
    [resolve(dbMain, 'index.ts')]: shim('database-main.ts'),
    [resolve(dbMain, 'sqlite.ts')]: shim('sqlite-browser.ts')
  }
  return {
    name: 'nova-platform-shims',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (source === '@modules/database/main') return shim('database-main.ts')
      if (source === '@main/logger') return shim('logger.ts')
      if (!importer || !source.startsWith('.')) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      if (resolved && redirects[resolved.id]) return redirects[resolved.id]
      return null
    }
  }
}

export const sharedAliases = [
  // الترتيب مهم: البدائل المحددة قبل الاسم المستعار العام @modules
  { find: /^@modules\/database\/main$/, replacement: shim('database-main.ts') },
  { find: /^@main\/logger$/, replacement: shim('logger.ts') },
  // وحدات Node التي تستوردها بعض مستودعات Windows ولا تُستعمل على iOS
  { find: /^node:(fs|fs\/promises|path|crypto)$/, replacement: resolve(__dirname, 'src/platform/shims/node-unavailable.ts') },
  { find: '@shared', replacement: resolve(repo, 'src/shared') },
  { find: '@modules', replacement: resolve(repo, 'src/modules') },
  { find: '@app', replacement: resolve(__dirname, 'src') },
  // pdf.js «legacy» يدعم Safari/WKWebView الأقدم (iOS 16) دون Promise.withResolvers
  { find: /^pdfjs-dist$/, replacement: 'pdfjs-dist/legacy/build/pdf.mjs' },
  { find: /^pdfjs-dist\/build\/pdf\.worker\.min\.mjs/, replacement: 'pdfjs-dist/legacy/build/pdf.worker.min.mjs' }
]

export default defineConfig({
  root: __dirname,
  base: './',
  plugins: [novaPlatformShims(), react()],
  resolve: {
    alias: sharedAliases,
    // الشيفرة المشتركة تقع خارج هذا المجلد: نجبر الحزم على نسخة واحدة من node_modules الخاص بالتطبيق
    dedupe: ['pdf-lib', '@pdf-lib/fontkit', 'pdfjs-dist', 'xlsx', 'sql.js', 'react', 'react-dom', 'i18next', 'react-i18next', 'zustand', 'tesseract.js', 'lucide-react', 'clsx']
  },
  server: { fs: { allow: [repo] }, port: 5180 },
  build: {
    outDir: 'dist',
    target: ['safari16', 'es2022'],
    sourcemap: false,
    chunkSizeWarningLimit: 4000
  },
  worker: { format: 'es' },
  assetsInclude: ['**/*.wasm', '**/*.traineddata', '**/*.gz']
})
