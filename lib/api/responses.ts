import { NextResponse } from 'next/server'

/** Lo que ve la persona cuando una API no pudo LEER lo que necesitaba (la base no contestó a tiempo, un 5xx). */
export const DB_UNAVAILABLE_MESSAGE = 'No pudimos leer los datos. Intenta de nuevo en unos segundos.'

/** 503: la lectura falló, no es que el dato no exista (404) ni que la persona no pueda (403). Reintentar suele bastar. */
export function dbUnavailableResponse() {
  return NextResponse.json({ error: DB_UNAVAILABLE_MESSAGE }, { status: 503 })
}

/** Lo mismo, dejando en el registro qué se leía. Solo código y mensaje: el objeto de error de PostgREST puede traer la
 *  fila que falló en `details`. */
export function dbUnavailable(what: string, error: { message: string; code?: string }) {
  console.error(`[api] ${what}: ${error.code ?? ''} ${error.message}`.trim())
  return dbUnavailableResponse()
}
