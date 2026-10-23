import { createHash } from 'node:crypto'

/** Ventana de la clave: dos peticiones idénticas dentro de ella comparten clave. Resend no documenta si un primer
 *  intento FALLIDO consume la clave (el sobrante de 24 h es suyo); con esta ventana, quien reintenta a propósito tras
 *  un fallo no queda bloqueado más de unos minutos, y un doble envío (que llega con milisegundos de diferencia) cae casi
 *  siempre en la misma ventana. */
export const IDEMPOTENCY_WINDOW_MS = 2 * 60 * 1000

/** La clave de idempotencia de Resend (1–256 caracteres): `tipo/ámbito/ventana/huella-del-contenido`.
 *
 *  La huella incluye el contenido: si el entregable cambió entre dos intentos la clave cambia, y así Resend nunca
 *  responde `409 invalid_idempotent_request` (misma clave con otro contenido). */
export function idempotencyKey(kind: string, scope: string, content: string, now: number = Date.now()): string {
  const fingerprint = createHash('sha256').update(content).digest('hex').slice(0, 32)
  return `${kind}/${scope}/${Math.floor(now / IDEMPOTENCY_WINDOW_MS)}/${fingerprint}`
}

/** Los dos errores con que Resend dice «este envío ya está hecho o en marcha»: no es un fallo ni hay que reintentar. */
export function isDuplicateSend(error: { name?: string } | null | undefined): boolean {
  return error?.name === 'concurrent_idempotent_requests' || error?.name === 'invalid_idempotent_request'
}

/** Lo que se contesta cuando otro envío idéntico ya está en marcha. */
export const SEND_IN_PROGRESS_MESSAGE = 'Este entregable ya se está enviando. Espera unos segundos y revisa el estado.'
