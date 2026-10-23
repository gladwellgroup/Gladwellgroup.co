/** Lo que supabase-js entrega en `error` cuando una consulta falla. */
type QueryErrorLike = { message: string; code?: string }

/** Los códigos que NO son una caída sino «no existe tal fila»: PGRST116 es un `.single()` sin filas y 22P02 un id
 *  que no es un UUID (escrito a mano en la URL, por ejemplo). Los dos son un 404 normal. */
const NOT_FOUND_CODES = new Set(['PGRST116', '22P02'])

/** ¿La consulta falló de verdad (la base no contestó a tiempo, una columna que no existe, un 5xx…)? A diferencia de
 *  «no hay tal fila», que es un resultado válido. */
export function isQueryFailure(error: QueryErrorLike | null | undefined): error is QueryErrorLike {
  return !!error && !(error.code && NOT_FOUND_CODES.has(error.code))
}

/** Una consulta que falló. La recoge `app/(portal)/error.tsx`, que ofrece «Reintentar». */
export class QueryFailedError extends Error {
  constructor(what: string, error: QueryErrorLike) {
    super(`${what}: ${error.message}`)
    this.name = 'QueryFailedError'
  }
}

/** Los datos de una consulta, o lanza si falló.
 *
 *  Un error de la base NO es «no hay nada»: leer solo `{ data }` pintaba «No hay leads registrados» (o un 404) ante
 *  un tope de tiempo, y quien lo veía creía que se había perdido su información. Lanzando, el fallo llega a la
 *  pantalla de error con su botón para reintentar. «No hay tal fila» (un `.single()` sin filas, un id que no es
 *  UUID) no es un fallo: devuelve `data` en `null` para que quien llama responda 404. */
export function must<T>(result: { data: T; error: QueryErrorLike | null }, what: string): T {
  if (isQueryFailure(result.error)) throw new QueryFailedError(what, result.error)
  return result.data
}
