import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { aiProviderInfo, getAiProvider, setAiRuntimeConfig } from '@/server/ai/provider'
import type { DatabaseHandle } from '@/server/db/connect'
import { appSettings, auditLogs } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { clearAiCredentials, getAiCredentials, loadAiCredentials, saveAiCredentials } from '@/server/services/ai-credentials.service'
import { makeAdmin, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
const OPENAI_KEY = 'sk-proj-' + 'a'.repeat(40) + 'WXYZ'
const ANTHROPIC_KEY = 'sk-ant-api03-' + 'b'.repeat(40) + 'QRST'

const answer = (status: number) =>
  vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => ({ ok: status < 400, status, json: async () => ({}), text: async () => '' }) as unknown as Response)

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
})

afterAll(async () => {
  setAiRuntimeConfig(null)
  await h.close()
})

describe('مفتاح الذكاء الاصطناعي من لوحة الإدارة', () => {
  it('يرفض الشكل الخاطئ والمفتاح المرفوض عند المزوّد دون حفظ شيء', async () => {
    const ok = answer(200)
    await expect(saveAiCredentials(h.db, admin, { provider: 'anthropic', apiKey: OPENAI_KEY }, { fetch: ok })).rejects.toMatchObject({ code: 'AI_KEY_FORMAT' })
    await expect(saveAiCredentials(h.db, admin, { provider: 'openai', apiKey: ANTHROPIC_KEY }, { fetch: ok })).rejects.toMatchObject({ code: 'AI_KEY_FORMAT' })
    expect(ok).not.toHaveBeenCalled()
    await expect(saveAiCredentials(h.db, admin, { provider: 'openai', apiKey: OPENAI_KEY }, { fetch: answer(401) })).rejects.toMatchObject({ code: 'AI_KEY_INVALID' })
    await expect(saveAiCredentials(h.db, admin, { provider: 'openai', apiKey: OPENAI_KEY, model: 'gpt-none' }, { fetch: answer(404) })).rejects.toMatchObject({ code: 'AI_MODEL_UNKNOWN' })
    await expect(saveAiCredentials(h.db, admin, { provider: 'openai', apiKey: OPENAI_KEY }, { fetch: answer(500) })).rejects.toMatchObject({ code: 'AI_KEY_UNREACHABLE' })
    expect(await getAiCredentials(h.db, admin)).toBeNull()
  })

  it('للمدير وحده', async () => {
    await expect(saveAiCredentials(h.db, teacher, { provider: 'openai', apiKey: OPENAI_KEY }, { fetch: answer(200) })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(getAiCredentials(h.db, teacher)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('يُختبر ويُحفظ مشفّراً ويسري فوراً، ولا يعود المفتاح في أي عرض أو سجل', async () => {
    const fn = answer(200)
    const view = await saveAiCredentials(h.db, admin, { provider: 'anthropic', apiKey: ` ${ANTHROPIC_KEY}\n`, model: '' }, { fetch: fn })
    expect(view).toMatchObject({ provider: 'anthropic', model: 'claude-sonnet-5', hint: 'QRST', usable: true })
    expect(String(fn.mock.calls[0]![0])).toBe('https://api.anthropic.com/v1/models/claude-sonnet-5')
    expect((fn.mock.calls[0]![1]!.headers as Record<string, string>)['x-api-key']).toBe(ANTHROPIC_KEY)

    const [row] = await h.db.select().from(appSettings).where(eq(appSettings.key, 'ai_credentials'))
    expect(JSON.stringify(row!.value)).not.toContain(ANTHROPIC_KEY.slice(10, 30))
    const audit = await h.db.select().from(auditLogs).where(eq(auditLogs.action, 'settings.ai_key'))
    expect(JSON.stringify(audit)).not.toContain(ANTHROPIC_KEY.slice(10, 30))
    expect(JSON.stringify(await getAiCredentials(h.db, admin))).not.toContain(ANTHROPIC_KEY.slice(10, 30))

    expect(getAiProvider().name).toBe('anthropic')
    expect(aiProviderInfo()).toMatchObject({ name: 'anthropic', model: 'claude-sonnet-5', source: 'admin' })
  })

  it('يُستعاد بعد إعادة التشغيل، ويُبطَل إن تغيّر سرّ الخادم', async () => {
    setAiRuntimeConfig(null)
    expect(getAiProvider().name).toBe('mock')
    await loadAiCredentials(h.db)
    expect(getAiProvider().name).toBe('anthropic')

    const secret = process.env.SESSION_SECRET
    process.env.SESSION_SECRET = 'another-secret-after-rotation'
    try {
      expect(await getAiCredentials(h.db, admin)).toMatchObject({ usable: false })
      await loadAiCredentials(h.db)
      expect(getAiProvider().name).toBe('mock')
    } finally {
      process.env.SESSION_SECRET = secret
    }
  })

  it('استبدال المزوّد ثم الحذف يعيد المنصة إلى ملف البيئة', async () => {
    await saveAiCredentials(h.db, admin, { provider: 'openai', apiKey: OPENAI_KEY, model: 'gpt-4.1' }, { fetch: answer(200) })
    expect(aiProviderInfo()).toMatchObject({ name: 'openai', model: 'gpt-4.1', source: 'admin' })
    await clearAiCredentials(h.db, admin)
    expect(await getAiCredentials(h.db, admin)).toBeNull()
    expect(aiProviderInfo()).toMatchObject({ name: 'mock', source: 'none' })
  })
})
