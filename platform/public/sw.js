/* عامل الخدمة: غلاف بلا اتصال + تخزين الأصول الثابتة + إشعارات الدفع */
const VERSION = 'v1'
const SHELL_CACHE = `madrasa-shell-${VERSION}`
const STATIC_CACHE = `madrasa-static-${VERSION}`
const OFFLINE_URL = '/offline'
const PRECACHE = [OFFLINE_URL, '/icon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // لا تخزين لواجهة API ولا للملفات الموقّعة
  if (url.pathname.startsWith('/api/')) return

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      })
    )
    return
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(SHELL_CACHE)
        return (await cache.match(OFFLINE_URL)) || Response.error()
      })
    )
  }
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'مدرسة', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'مدرسة'
  const options = {
    body: data.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    dir: 'rtl',
    lang: 'ar',
    data: { url: data.url || '/' },
    tag: data.tag || undefined
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(url)
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
