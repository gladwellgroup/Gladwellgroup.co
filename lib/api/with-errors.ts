import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { dbUnavailableResponse } from '@/lib/api/responses'
import { QueryFailedError } from '@/lib/supabase/must'
import { logError } from '@/lib/log'

/** Envuelve el handler de una ruta de API para que lo que NO atrapó salga como JSON y no como un 500 vacío.
 *
 *  - Una consulta que falló (`must()` lanza `QueryFailedError`) es un 503 reintentable, no un fallo del código.
 *  - Cualquier otro error es un 500 con un texto en español; en el registro queda `nombre: mensaje`, nunca el objeto
 *    completo (el de PostgREST puede traer la fila que falló).
 *
 *  Las rutas de trabajo largo (síntesis, aprobar, PDF, reenvíos) hacen muchas lecturas seguidas: con `must()` dentro y
 *  este envoltorio fuera, cada lectura que falla corta con un 503 sin repetir el mismo `if` en cada una. */
export function withApiErrors<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args)
    } catch (error) {
      // redirect() / notFound() / errores internos de Next no son fallos: se dejan pasar.
      unstable_rethrow(error)
      if (error instanceof QueryFailedError) {
        logError('[api]', error.message)
        return dbUnavailableResponse()
      }
      console.error('[api] Error no controlado:', error instanceof Error ? `${error.name}: ${error.message}` : String(error))
      return NextResponse.json({ error: 'Ocurrió un error inesperado. Intenta de nuevo.' }, { status: 500 })
    }
  }
}
