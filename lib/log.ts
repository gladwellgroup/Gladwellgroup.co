/** Una línea legible de un error, SIN volcar el objeto entero. El error de PostgREST trae en `details` la fila que falló
 *  («Key (correo)=(ana@x.co) already exists»): `console.error(msg, error)` lo dejaba, con los datos personales, en los
 *  registros del servidor.
 *
 *  - Un `Error` (una excepción): su traza (mensaje + marcos), que no lleva propiedades extra.
 *  - Un objeto de error de Supabase (`{ code, message }`): código y mensaje.
 *  - Cualquier otra cosa: su texto. */
export function describeError(error: unknown): string {
  if (error == null) return 'sin detalle'
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`
  if (typeof error === 'object') {
    const { code, message } = error as { code?: unknown; message?: unknown }
    const parts = [typeof code === 'string' || typeof code === 'number' ? String(code) : '', typeof message === 'string' ? message : '']
    const line = parts.filter(Boolean).join(' ')
    if (line) return line
  }
  return String(error)
}

/** Registra un error con su contexto (`[ruta] qué se intentaba`), sin el objeto completo. */
export function logError(scope: string, error: unknown): void {
  console.error(`${scope}: ${describeError(error)}`)
}
