import { cache } from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { type Permission } from '@/lib/permissions/matrix'
import { SessionLoadError, loadSessionUser, type SessionUser } from '@/lib/auth/session-user'
import { isAuthUnavailable } from '@/lib/auth/unavailable'
import { fetchWithTimeout } from '@/lib/supabase/fetch'

export { SessionLoadError, type SessionUser }

/** El cliente de Supabase con las cookies de sesión de esta petición. */
export async function getSupabaseServerSession() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchWithTimeout },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — cookies are read-only
          }
        },
      },
    }
  )
}

type SessionState = { kind: 'anonymous' } | { kind: 'sin-perfil' } | { kind: 'user'; user: SessionUser }

/** Quién es la persona de esta petición. `cache()` la memoiza por petición: el layout y la página no repiten la
 *  consulta del perfil. Lanza `SessionLoadError` si no se pudo saber. */
const getSessionState = cache(async (): Promise<SessionState> => {
  const supabase = await getSupabaseServerSession()

  // El middleware ya verificó la sesión y releva el id verificado vía este header (ver lib/supabase/middleware.ts):
  // evita repetir esa verificación aquí. Si falta (ruta no cubierta por el matcher), se verifica directo.
  let userId = (await headers()).get('x-gladwell-user-id')

  if (!userId) {
    // Con llave de firma asimétrica se verifica el JWT en local, sin viaje a Supabase; con el secreto HS256
    // heredado, auth-js cae solo a `getUser()`.
    const { data, error } = await supabase.auth.getClaims()
    // Una caída de Auth (timeout, 5xx) NO es «sin sesión»: no se manda a /login por eso.
    if (isAuthUnavailable(error)) {
      throw new SessionLoadError('No se pudo validar la sesión', { cause: error })
    }
    userId = data?.claims?.sub ?? null
  }

  if (!userId) return { kind: 'anonymous' }

  const lookup = await loadSessionUser(supabase, userId)
  if (lookup.status === 'error') {
    throw new SessionLoadError(`No se pudo cargar el perfil: ${lookup.message}`)
  }
  if (lookup.status === 'sin-perfil') return { kind: 'sin-perfil' }
  return { kind: 'user', user: lookup.user }
})

export const getSession = cache(async function getSession(): Promise<SessionUser | null> {
  const state = await getSessionState()
  return state.kind === 'user' ? state.user : null
})

export async function requireAuth(): Promise<SessionUser> {
  const state = await getSessionState()
  if (state.kind === 'user') return state.user
  // Con sesión pero sin fila en `profiles`: mandarla a /login formaba un bucle (el middleware devuelve de /login
  // a /perfil a quien tiene sesión). La ruta cierra esa sesión y la lleva al login con el aviso.
  if (state.kind === 'sin-perfil') redirect('/api/auth/signout')
  redirect('/login')
}

export async function requirePermission(
  permission: Permission
): Promise<SessionUser> {
  const session = await requireAuth()
  if (!session.permissions.includes(permission)) {
    redirect('/dashboard')
  }
  return session
}
