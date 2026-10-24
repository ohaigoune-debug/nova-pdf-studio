/**
 * عميل EcoTrack بلا شبكة: خريطة الحالات، حمولة إنشاء الطرد، معالجة 429، قراءة التتبّع والرسوم، وميزانية الاستطلاع.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { EcotrackClient, EcotrackError, _resetEcotrackCaches, communeKey, localPhone, mapEcotrackStatus } from '@/server/lib/ecotrack'

type Route = (url: URL, init: RequestInit) => { status?: number; body?: unknown; headers?: Record<string, string> }

function fakeFetch(routes: Record<string, Route>, log: { url: string; method: string; body: unknown }[] = []): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    log.push({ url: url.toString(), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : null })
    const key = Object.keys(routes).find((k) => url.pathname.endsWith(k))
    if (!key) return new Response('not found', { status: 404 })
    const r = routes[key]!(url, init ?? {})
    return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: { 'content-type': 'application/json', ...(r.headers ?? {}) } })
  }) as typeof fetch
}

const creds = { baseUrl: 'anderson.ecotrack.dz', apiToken: 'tok_1234567890abcdef' }

beforeEach(() => _resetEcotrackCaches())

describe('خريطة حالات EcoTrack (نصّ فرنسي حرّ)', () => {
  it('كل مرحلة retour مرتجع؛ livré/encaissé مسلَّم؛ tentative محاولة فاشلة؛ prête à expédier لم يتحرّك', () => {
    expect(mapEcotrackStatus('Livré')).toBe('delivered')
    expect(mapEcotrackStatus('livré_non_encaissé')).toBe('delivered')
    expect(mapEcotrackStatus('Encaissé')).toBe('delivered')
    expect(mapEcotrackStatus('Retourné au vendeur')).toBe('returned')
    expect(mapEcotrackStatus('retour_transit_entrepot')).toBe('returned')
    expect(mapEcotrackStatus('Tentative échouée')).toBe('failed_attempt')
    expect(mapEcotrackStatus('Client injoignable')).toBe('failed_attempt')
    expect(mapEcotrackStatus('Sorti en livraison')).toBe('out_for_delivery')
    expect(mapEcotrackStatus('Reçu à wilaya')).toBe('at_agency')
    expect(mapEcotrackStatus('Prête à expédier')).toBe('created')
    expect(mapEcotrackStatus('En transit vers wilaya')).toBe('in_transit')
    expect(mapEcotrackStatus('Ramassé')).toBe('picked_up')
    expect(mapEcotrackStatus('Nouveau')).toBe('created')
    expect(mapEcotrackStatus('Supprimé')).toBe('canceled')
    expect(mapEcotrackStatus('')).toBeNull()
    expect(mapEcotrackStatus('???')).toBeNull()
  })
  it('الهاتف محلي والبلدية مطبَّعة', () => {
    expect(localPhone('+213 555 12 34 56')).toBe('0555123456')
    expect(localPhone('0555123456')).toBe('0555123456')
    expect(localPhone('555123456')).toBe('0555123456')
    expect(communeKey("Aïn M'lila")).toBe('ainmlila')
    expect(communeKey('Bou Saâda')).toBe('bousaada')
  })
})

describe('إنشاء الطرد', () => {
  it('يحلّ البلدية إلى إملاء EcoTrack ويرسل الحمولة بالحقول المتوقعة ويعيد رقم التتبّع', async () => {
    const log: { url: string; method: string; body: unknown }[] = []
    const client = new EcotrackClient(
      creds,
      fakeFetch(
        {
          '/api/v1/get/communes': () => ({ body: { '1': { id: 1, nom: 'Bou Saada', wilaya_id: 28, has_stop_desk: 1 }, '2': { id: 2, nom: 'Alger Centre', wilaya_id: 16 } } }),
          '/api/v1/create/order': () => ({ body: { success: true, tracking: 'ECO-777' } })
        },
        log
      )
    )
    const r = await client.createOrder({ orderNumber: 'MD-1', fullName: 'زبون', phone: '+213555123456', address: 'حي النصر', wilayaCode: '28', communeName: 'بوسعادة / Bou Saâda', codAmountDzd: 1600, productsSummary: 'كتاب وسام التفوق', deliveryType: 'HOME' })
    expect(r.tracking).toBe('ECO-777')
    const create = log.find((l) => l.url.includes('create/order'))!
    expect(create.method).toBe('POST')
    const body = create.body as Record<string, unknown>
    expect(body.reference).toBe('MD-1')
    expect(body.telephone).toBe('0555123456')
    expect(body.code_wilaya).toBe(28)
    expect(body.montant).toBe(1600)
    expect(body.stop_desk).toBe(0)
    expect(body.type).toBe(1)
    expect(body.stock).toBe(0)
    // بلدية EcoTrack: "Bou Saada" بالمعرّف 1 رغم أن اسمنا بالعربية + فرنسية بعلامات
    expect(body.commune).toBe('Bou Saada')
    expect(body.commune_id).toBe('1')
    expect(log.find((l) => l.url.includes('create/order'))!.url.startsWith('https://anderson.ecotrack.dz/')).toBe(true)
  })
  it('success:false أو بلا tracking ⇒ خطأ واضح', async () => {
    const client = new EcotrackClient(creds, fakeFetch({ '/api/v1/get/communes': () => ({ body: {} }), '/api/v1/create/order': () => ({ body: { success: false, message: 'commune invalide' } }) }))
    await expect(client.createOrder({ orderNumber: 'MD-2', fullName: 'x', phone: '0555000000', address: '', wilayaCode: '16', communeName: 'nowhere', codAmountDzd: 0, productsSummary: 'p' })).rejects.toThrow(/commune invalide/)
  })
  it('429 يُعاد بعد تأخير ثم ينجح؛ وأربع مرات ⇒ خطأ 429', async () => {
    let n = 0
    const sleeps: number[] = []
    const client = new EcotrackClient(
      creds,
      fakeFetch({ '/api/v1/get/wilayas': () => (++n < 3 ? { status: 429, body: 'Too Many Attempts', headers: { 'retry-after': '1' } } : { body: { '16': { id: 16, nom: 'Alger' } } }) }),
      async (ms) => void sleeps.push(ms)
    )
    expect(await client.validate()).toEqual({ ok: true, wilayas: 1 })
    expect(sleeps).toEqual([1000, 1000])
    const always = new EcotrackClient(creds, fakeFetch({ '/api/v1/get/wilayas': () => ({ status: 429, body: 'Too Many Attempts' }) }), async () => {})
    const v = await always.validate()
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.message).toMatch(/429/)
  })
  it('401 ⇒ رفض الرمز؛ 404 ⇒ رابط خاطئ', async () => {
    const bad = new EcotrackClient(creds, fakeFetch({ '/api/v1/get/wilayas': () => ({ status: 401, body: {} }) }))
    expect(await bad.validate()).toMatchObject({ ok: false, message: expect.stringMatching(/token/) })
    const wrong = new EcotrackClient(creds, fakeFetch({}))
    expect(await wrong.validate()).toMatchObject({ ok: false, message: expect.stringMatching(/platform URL/) })
  })
})

describe('التتبّع والرسوم والميزانية', () => {
  it('سجلّ الطلب يعطي الحالة والسائق والرسم؛ حالة معروفة لم تتغيّر ⇒ نداء واحد فقط', async () => {
    const log: { url: string; method: string; body: unknown }[] = []
    const client = new EcotrackClient(
      creds,
      fakeFetch(
        {
          '/api/v1/get/orders': () => ({ body: { data: [{ tracking: 'ECO-1', status: 'En transit vers wilaya', driver_name: 'Karim', driver_phone: '0661000000', tarif_prestation: 450 }] } }),
          '/api/v1/get/tracking/info': () => ({ body: { activity: [{ event: 'En transit vers wilaya', causer: 'Hub Alger', date: '2026-10-24 10:00:00' }, { event: 'Ramassé', date: '2026-10-23 09:00:00' }] } })
        },
        log
      )
    )
    const t = await client.tracking('ECO-1')
    expect(t.status).toBe('in_transit')
    expect(t.driverName).toBe('Karim')
    expect(t.feeDzd).toBe(450)
    expect(t.events.map((e) => e.status)).toEqual(['picked_up', 'in_transit'])
    log.length = 0
    const again = await client.tracking('ECO-1', 'in_transit')
    expect(again.status).toBe('in_transit')
    expect(log.length).toBe(1)
  })
  it('سجلّ الأحداث وحده (بلا سجلّ طلب): الأحدث يحدّد الحالة، ولا يُرجَع المرتجع إلى «في الطريق»', async () => {
    const client = new EcotrackClient(creds, fakeFetch({ '/api/v1/get/orders': () => ({ body: { data: [] } }), '/api/v1/get/tracking/info': () => ({ body: { activity: [{ event: 'Retour chez livreur', date: '2026-10-25 08:00:00' }, { event: 'Livraison échouée', date: '2026-10-24 18:00:00' }, { event: 'En transit', date: '2026-10-23 10:00:00' }] } }) }))
    const t = await client.tracking('ECO-2')
    expect(t.status).toBe('returned')
  })
  it('لا بيانات ⇒ خطأ EcotrackError', async () => {
    const client = new EcotrackClient(creds, fakeFetch({ '/api/v1/get/orders': () => ({ body: { data: [] } }), '/api/v1/get/tracking/info': () => ({ body: { activity: [] } }) }))
    await expect(client.tracking('ECO-X')).rejects.toBeInstanceOf(EcotrackError)
  })
  it('جدول الرسوم: منزل/مكتب/إرجاع لكل ولاية، مع بدائل أسماء الحقول', async () => {
    const client = new EcotrackClient(creds, fakeFetch({ '/api/v1/get/fees': () => ({ body: { livraison: [{ wilaya_id: 16, tarif: 500, tarif_stopdesk: 350, retour: 250 }, { wilaya_id: 28, tarif: 800 }, { wilaya_id: 0, tarif: 0 }] } }) }))
    const fees = await client.fees()
    expect(fees).toEqual([
      { wilayaCode: '16', homeDzd: 500, deskDzd: 350, returnDzd: 250 },
      { wilayaCode: '28', homeDzd: 800, deskDzd: 800, returnDzd: 400 }
    ])
  })
  it('الميزانية: x-ratelimit-remaining تحت الاحتياطي توقف الاستطلاع', async () => {
    const client = new EcotrackClient(creds, fakeFetch({ '/api/v1/get/wilayas': () => ({ body: {}, headers: { 'x-ratelimit-remaining': '900' } }) }))
    expect(client.pollingAllowed()).toBe(true)
    await client.validate()
    expect(client.pollingAllowed()).toBe(false)
  })
})
