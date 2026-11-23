/** بديل @main/logger داخل التطبيق: لا ملفات سجل على الجهاز، فقط وحدة التحكم (تظهر في Xcode/Safari Web Inspector). */
type Level = 'debug' | 'info' | 'warn' | 'error'
function log(level: Level, message: string, meta?: unknown): void {
  const line = `[nova:${level}] ${message}`
  // eslint-disable-next-line no-console
  ;(level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line, meta ?? '')
}
export const logger = {
  debug: (m: string, meta?: unknown) => log('debug', m, meta),
  info: (m: string, meta?: unknown) => log('info', m, meta),
  warn: (m: string, meta?: unknown) => log('warn', m, meta),
  error: (m: string, meta?: unknown) => log('error', m, meta)
}
