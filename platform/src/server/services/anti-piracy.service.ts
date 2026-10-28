import 'server-only'

export interface AntiPiracyCase {
  id: number
  source: string
  url: string
  snippet: string
  matched_terms: string
  has_media: number
  published_at: string | null
  detected_at: string
  status: 'suspected' | 'confirmed' | 'dismissed'
}

export interface AntiPiracyDashboard {
  status: 'ready' | 'waiting' | 'offline'
  counts: Record<string, number>
  channels: string[]
  cases: AntiPiracyCase[]
  message?: string
}

/** Internal-only, read-only bridge. NEVER expose its token to the browser. */
export async function getAntiPiracyDashboard(): Promise<AntiPiracyDashboard> {
  const api = process.env.ANTI_PIRACY_API_URL
  const key = process.env.ANTI_PIRACY_API_KEY
  const fallback: AntiPiracyDashboard = {
    status: 'offline', counts: {}, channels: [], cases: [],
    message: 'خدمة مراقبة تيليغرام غير مفعلة على الخادم بعد.'
  }
  if (!api || !key) return fallback
  try {
    const response = await fetch(new URL('/v1/dashboard', api), {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000)
    })
    if (!response.ok) return { ...fallback, message: 'تعذّر الاتصال بخدمة المراقبة.' }
    const data: unknown = await response.json()
    if (typeof data !== 'object' || !data || !('status' in data)) return fallback
    const result = data as Partial<AntiPiracyDashboard>
    return {
      status: result.status === 'ready' ? 'ready' : 'waiting',
      counts: result.counts && typeof result.counts === 'object' ? result.counts : {},
      channels: Array.isArray(result.channels) ? result.channels : [],
      cases: Array.isArray(result.cases) ? result.cases : []
    }
  } catch {
    return fallback
  }
}
