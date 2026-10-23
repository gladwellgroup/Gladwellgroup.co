import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { loadSessionUser } from '@/lib/auth/session-user'
import { ACCESS_UNAVAILABLE_MESSAGE, isAuthUnavailable } from '@/lib/auth/unavailable'
import { fetchWithTimeout } from '@/lib/supabase/fetch'
import { getSupabaseServer } from '@/lib/supabase/server'
import { type Permission } from '@/lib/permissions/matrix'
import type { Role } from '@/lib/permissions/roles'
import { logError } from '@/lib/log'

/** 503: no se pudo COMPROBAR el acceso (Auth o la base no contestaron a tiempo). No es un 401 ni un 403: la persona
 *  no perdió su sesión ni su permiso, y reintentar suele bastar. */
function accessUnavailable() {
  return NextResponse.json({ error: ACCESS_UNAVAILABLE_MESSAGE }, { status: 503 })
}

type RequireApiUserResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse }

/** Usuario autenticado desde las cookies de sesión, para usar en API routes. Valida contra Supabase Auth
 *  (`getUser()`, no solo la firma del JWT): estas rutas escriben datos y una sesión revocada no debe poder hacerlo.
 *
 *  Distingue «sin sesión» (401) de «Auth no contestó» (503): antes ambos eran un 401 y, con el tope de tiempo de
 *  las llamadas, una consulta lenta le habría dicho «No autenticado» a quien sigue con su sesión. */
export async function requireApiUser(): Promise<RequireApiUserResult> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
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
            // Read-only en fase de respuesta de un route handler
          }
        },
      },
    }
  )
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (user) return { ok: true, user }
  if (isAuthUnavailable(error)) return { ok: false, response: accessUnavailable() }
  return {
    ok: false,
    response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }),
  }
}

type RequireApiPermissionResult =
  | { ok: true; user: User; role: Role; permissions: Permission[] }
  | { ok: false; response: NextResponse }

/** Reemplaza el patrón repetido "requireApiUser + select role + hasPermission"
 *  de las API routes, ahora resolviendo también los módulos otorgados por
 *  persona (profile_module_grants) en la misma consulta. */
export async function requireApiPermission(
  permission: Permission
): Promise<RequireApiPermissionResult> {
  const auth = await requireApiUser()
  if (!auth.ok) return auth

  const lookup = await loadSessionUser(getSupabaseServer(), auth.user.id)

  // La consulta falló: no se sabe si tiene el permiso. 503 y no 403 («Sin permisos» a quien sí lo tiene).
  if (lookup.status === 'error') {
    logError('[api-auth] No se pudo cargar el perfil', lookup.message)
    return { ok: false, response: accessUnavailable() }
  }

  if (lookup.status === 'sin-perfil' || !lookup.user.permissions.includes(permission)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Sin permisos' }, { status: 403 }),
    }
  }

  return {
    ok: true,
    user: auth.user,
    role: lookup.user.role,
    permissions: lookup.user.permissions,
  }
}
