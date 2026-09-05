import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getSupabaseServer } from '@/lib/supabase/server'
import { type Permission } from '@/lib/permissions/matrix'
import { resolvePermissionsFromGrants } from '@/lib/permissions/resolve'
import type { Role } from '@/lib/permissions/roles'

/** Usuario autenticado desde las cookies de sesión, para usar en API routes. */
export async function getAuthUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
  } = await supabase.auth.getUser()
  return user
}

type RequireApiPermissionResult =
  | { ok: true; user: User; role: Role; permissions: Permission[] }
  | { ok: false; response: NextResponse }

/** Reemplaza el patrón repetido "getAuthUser + select role + hasPermission"
 *  de las API routes, ahora resolviendo también los módulos otorgados por
 *  persona (profile_module_grants) en la misma consulta. */
export async function requireApiPermission(
  permission: Permission
): Promise<RequireApiPermissionResult> {
  const user = await getAuthUser()
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }),
    }
  }

  const supabase = getSupabaseServer()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, profile_module_grants!profile_module_grants_profile_id_fkey(module_key)')
    .eq('id', user.id)
    .single()

  const permissions = profile
    ? resolvePermissionsFromGrants(profile.role as Role, profile.profile_module_grants)
    : []

  if (!profile || !permissions.includes(permission)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Sin permisos' }, { status: 403 }),
    }
  }

  return { ok: true, user, role: profile.role as Role, permissions }
}
