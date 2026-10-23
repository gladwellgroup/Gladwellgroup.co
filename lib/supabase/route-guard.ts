import { PORTAL_PREFIXES } from '@/lib/data/portal-routes'

export type RouteDecision = 'continue' | 'to-login' | 'to-perfil'

/** Qué hace el middleware con una petición según quién es la persona. Pura, para poder probarla sin Next ni
 *  Supabase; `updateSession` (lib/supabase/middleware.ts) solo la ejecuta.
 *
 *  `sessionUnknown`: la sesión no se pudo VERIFICAR (Supabase Auth no contestó a tiempo, un 5xx). No es «sin
 *  sesión»: mandar a /login por eso cerraba la sesión de todo el mundo durante una caída. La petición pasa y la
 *  página lo vuelve a intentar; si sigue fallando, muestra la pantalla de error con «Reintentar». */
export function decideRoute({
  pathname,
  userId,
  sessionUnknown,
}: {
  pathname: string
  /** El id ya verificado de la persona, o `null` si no hay sesión. */
  userId: string | null
  sessionUnknown: boolean
}): RouteDecision {
  const isPortalRoute = PORTAL_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/invite')

  if (!userId && isPortalRoute && !sessionUnknown) return 'to-login'
  if (userId && isAuthRoute) return 'to-perfil'
  return 'continue'
}
