/** Una petición de guardado que se manda al salir de la página. */
export interface KeepaliveRequest {
  url: string
  method: 'PATCH' | 'POST'
  body: unknown
}

/** El navegador reparte 64 KB entre todas las peticiones `keepalive` en vuelo; con un cuerpo mayor la petición se
 *  rechaza. Los textos de los formularios están muy por debajo; si alguno pasara, se manda como una petición normal
 *  (que en una navegación dentro del portal también llega; solo una recarga o cierre podría cortarla). */
export const KEEPALIVE_MAX_BYTES = 60 * 1024

/** Manda los guardados pendientes al salir (navegar, cerrar, pasar a segundo plano). `keepalive: true` hace que el
 *  navegador complete la petición aunque la página se descargue. No espera ni informa: la página ya se va. */
export function sendOnLeave(requests: KeepaliveRequest[], doFetch: typeof fetch = fetch): void {
  for (const request of requests) {
    const body = JSON.stringify(request.body)
    const keepalive = new TextEncoder().encode(body).length <= KEEPALIVE_MAX_BYTES
    doFetch(request.url, {
      method: request.method,
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive,
      credentials: 'same-origin',
    }).catch(() => {})
  }
}
