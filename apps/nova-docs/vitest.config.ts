import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import { novaPlatformShims, sharedAliases } from './vite.config'

export default defineConfig({
  plugins: [novaPlatformShims()],
  resolve: {
    alias: sharedAliases.filter((a) => typeof a.find === 'string' || (!String(a.find).includes('pdfjs') && !String(a.find).includes('node:'))),
    dedupe: ['pdf-lib', '@pdf-lib/fontkit', 'xlsx', 'sql.js']
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 120_000,
    root: resolve(__dirname)
  }
})
