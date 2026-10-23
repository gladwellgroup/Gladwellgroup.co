import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js'

/** Lo que ve la persona cuando no se pudo COMPROBAR su acceso (la base o Auth no contestaron a tiempo). */
export const ACCESS_UNAVAILABLE_MESSAGE = 'No pudimos verificar tu acceso. Intenta de nuevo en unos segundos.'

/** El error de Auth viene de que Auth no contestó bien (red caída, tope de tiempo, 5xx) y no de que la persona no
 *  tenga sesión. Distinguirlos importa: tratar una caída como «sin sesión» mandaba a /login (y cerraba la sesión
 *  de todo el mundo durante la caída) o respondía 401 a quien sigue autenticado. */
export function isAuthUnavailable(error: unknown): boolean {
  return isAuthRetryableFetchError(error) || (isAuthApiError(error) && error.status >= 500)
}
