/** Tiempo máximo de una consulta (lectura) a la base de datos, o de cualquier llamada a Auth. */
export const SUPABASE_TIMEOUT_MS = 8000

/** Tiempo máximo de una ESCRITURA a la base de datos (INSERT/UPDATE/DELETE). Más holgado a propósito: abortar una
 *  escritura que el servidor ya aplicó le deja a la persona un error, y al reintentar duplica la fila. Una lectura
 *  abortada, en cambio, se repite sin riesgo. */
export const SUPABASE_WRITE_TIMEOUT_MS = 30000

/** Solo las consultas (`/rest/v1/`) y la sesión (`/auth/v1/`): Storage (subidas de audio y fotos) y lo demás
 *  pueden tardar legítimamente mucho más. */
const WITH_TIMEOUT = /\/(?:rest|auth)\/v1\//

/** Una señal que se aborta cuando se aborta cualquiera de las dos (`AbortSignal.any`, sin depender de que el runtime
 *  —Node, Edge— lo tenga). */
function eitherSignal(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController()
  for (const signal of [a, b]) {
    if (signal.aborted) controller.abort(signal.reason)
    else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  }
  return controller.signal
}

/** Una señal que se aborta a los `ms` con un `AbortError`, no con el `TimeoutError` de `AbortSignal.timeout`.
 *
 *  La diferencia importa: postgrest-js reintenta los GET cuyo `fetch` falla por cualquier motivo EXCEPTO un
 *  `AbortError`, con esperas de 1, 2 y 4 s. Con un `TimeoutError`, una consulta colgada tardaba 8 + 1 + 8 + 2 + 8 + 4 + 8
 *  = 39 s en fallar (medido en el laboratorio) en vez de 8: reintentar algo que ya esperó `ms` sin que Supabase
 *  conteste solo alarga la espera. Los cortes de conexión sí se siguen reintentando. */
function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController()
  // El oyente mantiene viva la señal del temporizador (sin él, el recolector de basura puede soltarla antes de que venza).
  AbortSignal.timeout(ms).addEventListener(
    'abort',
    () => controller.abort(new DOMException(`Supabase no contestó en ${ms} ms`, 'AbortError')),
    { once: true }
  )
  return controller.signal
}

/** Un `fetch` que aborta las llamadas a la base de datos y a Auth: a los `readMs` las lecturas y todo lo de Auth, a
 *  los `writeMs` las escrituras a la base.
 *
 *  Sin tope, una consulta que Supabase no contesta deja la página colgada hasta que el runtime la mata (minutos)
 *  y, como cada navegación pasa por el middleware y por la consulta del perfil, TODO el portal deja de navegar y
 *  recargar no ayuda. Con tope la consulta falla rápido: supabase-js devuelve un `error` (postgrest-js) o un
 *  `AuthRetryableFetchError` (auth-js) y la pantalla de error ofrece reintentar. El tope cubre también la
 *  lectura del cuerpo (la señal sigue activa hasta que se consume). */
export function createFetchWithTimeout(readMs: number, writeMs: number = readMs) {
  return function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!WITH_TIMEOUT.test(url)) return fetch(input, init)

    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const isRead = method === 'GET' || method === 'HEAD'
    const ms = url.includes('/auth/v1/') || isRead ? readMs : writeMs

    const timeout = timeoutSignal(ms)
    return fetch(input, { ...init, signal: init?.signal ? eitherSignal(init.signal, timeout) : timeout })
  }
}

/** El que usan los clientes de Supabase (`global: { fetch: fetchWithTimeout }`). */
export const fetchWithTimeout = createFetchWithTimeout(SUPABASE_TIMEOUT_MS, SUPABASE_WRITE_TIMEOUT_MS)
