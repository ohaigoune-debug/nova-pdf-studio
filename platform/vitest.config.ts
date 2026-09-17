import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    globals: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'pglite://memory',
      SESSION_SECRET: 'test-session-secret-do-not-use-in-prod',
      QR_TOKEN_SECRET: 'test-qr-secret-do-not-use-in-prod'
    }
  }
})
