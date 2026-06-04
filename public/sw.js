/**
 * Service Worker — Bendito Lanches PWA
 * Cache estratégico: Shell + Dados estáticos
 */

const CACHE_NAME = 'bendito-v1'
const CACHE_STATIC = 'bendito-static-v1'
const CACHE_DATA   = 'bendito-data-v1'

// Recursos do app shell (sempre em cache)
const SHELL_URLS = [
  '/',
  '/pdv',
  '/login',
  '/cliente',
  '/vendedor',
  '/offline',
]

// Rotas de dados para cache parcial (produtos, filiais)
const DATA_CACHE_PATTERNS = [
  /\/rest\/v1\/vw_produtos_filial/,
  /\/rest\/v1\/filiais/,
  /\/rest\/v1\/atendentes_pdv/,
]

// ── Install: cache do shell ──────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      return cache.addAll(SHELL_URLS).catch(() => {})
    })
  )
  self.skipWaiting()
})

// ── Activate: limpar caches antigos ─────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_STATIC && k !== CACHE_DATA)
            .map(k => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// ── Fetch: estratégia por tipo de recurso ───────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorar requests não-GET
  if (request.method !== 'GET') return

  // Ignorar extensões e analytics
  if (url.pathname.includes('_next/webpack') ||
      url.pathname.includes('hot-update') ||
      url.hostname.includes('analytics')) return

  // Dados da API Supabase — Network first, cache fallback
  if (url.hostname.includes('supabase.co')) {
    const isDataRoute = DATA_CACHE_PATTERNS.some(p => p.test(url.pathname + url.search))
    if (isDataRoute) {
      event.respondWith(networkFirstData(request))
    }
    return
  }

  // Recursos estáticos — Cache first
  if (url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/icons/') ||
      url.pathname.match(/\.(png|jpg|webp|svg|ico|woff2)$/)) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Páginas — Network first, fallback offline
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request))
    return
  }
})

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_STATIC)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('', { status: 404 })
  }
}

async function networkFirstData(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_DATA)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    return cached || new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function networkFirstPage(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_STATIC)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    return caches.match('/offline') || new Response('<h1>Sem conexão</h1>', {
      headers: { 'Content-Type': 'text/html' }
    })
  }
}

// ── Push notifications (futuro) ──────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title || 'Bendito Lanches', {
      body: data.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: { url: data.url || '/' },
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(clients.openWindow(url))
})
