// Service worker escrito a mano (no Serwist/next-pwa): el proyecto compila
// con Turbopack por defecto en Next 16, y esos plugins están pensados para
// el compilador de Webpack. Un archivo estático evita esa fricción y alcanza
// de sobra para "caché básico", que es todo lo que se pidió.
//
// Estrategia deliberadamente conservadora por ser un portal autenticado
// multi-usuario: cualquier ruta con datos personalizados jamás se sirve
// desde caché, sin excepción.

const CACHE_NAME = 'gladwell-v1'

const STATIC_PATH_PATTERNS = [
  /^\/_next\/static\//,
  /^\/icon/,
  /^\/apple-icon/,
  /^\/favicon/,
  /^\/og\//,
  /^\/brand\//,
]

function isStaticAsset(pathname) {
  return STATIC_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
}

// Todo lo que cuelga de (portal) + la API — nunca se cachea, aunque eso
// signifique repetir el patrón de rutas que ya vive en middleware.ts: acá
// el costo de un falso negativo (no cachear algo público por error) es
// mucho menor que el de un falso positivo (servir datos de otro usuario).
function isAuthenticatedRoute(pathname) {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/super/') ||
    pathname.startsWith('/comunidad/') ||
    pathname.startsWith('/perfil')
  )
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (isAuthenticatedRoute(url.pathname)) return

  if (isStaticAsset(url.pathname)) {
    // Cache-first: son assets de build (con hash) o de marca, no cambian
    // bajo la misma URL.
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        const response = await fetch(request)
        if (response.ok) cache.put(request, response.clone())
        return response
      })
    )
    return
  }

  // Páginas públicas de marketing: red primero (para no mostrar contenido
  // viejo mientras hay conexión), caché como respaldo sin conexión.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error()))
  )
})
