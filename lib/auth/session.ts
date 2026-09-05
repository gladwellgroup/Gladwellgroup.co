import { cache } from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { type Role } from '@/lib/permissions/roles'
import { type Permission } from '@/lib/permissions/matrix'
import { resolvePermissionsFromGrants } from '@/lib/permissions/resolve'

async function getSupabaseServerSession() {
  const cookieStore = await cookies()
  return createServerClient(
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
            // Server Component — cookies are read-only
          }
        },
      },
    }
  )
}

export interface SessionUser {
  id: string
  email: string
  role: Role
  nombre: string
  /** Base fija del rol ∪ módulos otorgados por persona (profile_module_grants). */
  permissions: Permission[]
}

export const getSession = cache(async function getSession(): Promise<SessionUser | null> {
  const supabase = await getSupabaseServerSession()

  // El middleware ya valida la sesión con auth.getUser() y releva el id
  // verificado vía este header (ver lib/supabase/middleware.ts) — evita
  // repetir esa misma llamada de red aquí. Si falta (ruta no cubierta por
  // el matcher del middleware), se valida directo como respaldo.
  let userId = (await headers()).get('x-gladwell-user-id')

  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    userId = user?.id ?? null
  }

  if (!userId) return null

  // El embed trae los módulos otorgados en la misma consulta (sigue siendo
  // un solo round-trip) — profile_module_grants tiene su propia RLS que
  // permite leer solo las filas propias.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nombre, correo, profile_module_grants!profile_module_grants_profile_id_fkey(module_key)')
    .eq('id', userId)
    .single()

  if (!profile) return null

  return {
    id: userId,
    email: profile.correo,
    role: profile.role as Role,
    nombre: profile.nombre,
    permissions: resolvePermissionsFromGrants(profile.role as Role, profile.profile_module_grants),
  }
})

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
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
