// Cuándo se considera VIVA la síntesis de un entregable. Sin dependencias: lo usan el servidor (las rutas de síntesis)
// y el navegador (los editores), y tienen que coincidir.

/** Un 'procesando' (o un 'generando' que nadie reclamó) más viejo que esto se considera muerto y se puede retomar.
 *  Está por encima del `maxDuration` de las rutas de síntesis (300 s): nunca pisa a un proceso vivo. */
export const STALE_PROCESSING_MS = 6 * 60 * 1000

/** Los estados en los que el servidor está (o debería estar) trabajando: 'generando' = creado, esperando a que alguien
 *  reclame el trabajo; 'procesando' = alguien lo reclamó y está sintetizando. */
export function isWorkingStatus(status: string | null | undefined): boolean {
  return status === 'generando' || status === 'procesando'
}

/** ¿Hay una síntesis VIVA? Un estado de trabajo cuyo inicio (`generated_at`) es reciente. Sin fecha no se puede saber
 *  cuánto lleva, así que se da por muerta: si no, quedaría bloqueada para siempre. */
export function isWorking(
  status: string | null | undefined,
  generatedAt: string | null | undefined,
  now: number = Date.now()
): boolean {
  if (!isWorkingStatus(status) || !generatedAt) return false
  // Una fecha inválida da NaN y toda comparación con NaN es falsa: también se da por muerta.
  return now - new Date(generatedAt).getTime() < STALE_PROCESSING_MS
}

/** En estado de trabajo pero vencida: el proceso murió (timeout, despliegue) y hay que ofrecer reintentar. */
export function isStale(
  status: string | null | undefined,
  generatedAt: string | null | undefined,
  now: number = Date.now()
): boolean {
  return isWorkingStatus(status) && !isWorking(status, generatedAt, now)
}
