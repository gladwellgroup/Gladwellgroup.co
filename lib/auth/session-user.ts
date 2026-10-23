import type { SupabaseClient } from '@supabase/supabase-js'
import { type Role } from '@/lib/permissions/roles'
import { type Permission } from '@/lib/permissions/matrix'
import { resolvePermissionsFromGrants } from '@/lib/permissions/resolve'

// La parte de la sesión que no toca Next (ni cookies ni redirecciones): los tipos, el error y la consulta del
// perfil. Va aparte de lib/auth/session.ts para poder probarla con un cliente de Supabase simulado.

export interface SessionUser {
  id: string
  email: string
  role: Role
  nombre: string
  /** Base fija del rol ∪ módulos otorgados por persona (profile_module_grants). */
  permissions: Permission[]
}

/** No se pudo saber QUIÉN es la persona (Supabase no contestó a tiempo, un 5xx…): no es «sin sesión». Lo recoge
 *  `app/error.tsx` con un botón para reintentar. Antes un fallo de la consulta del perfil se trataba como «sin
 *  sesión»: `requireAuth` mandaba a /login y el middleware devolvía de /login a /perfil a quien tiene sesión,
 *  en bucle. */
export class SessionLoadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'SessionLoadError'
  }
}

/** Lo mínimo que `loadSessionUser` necesita del cliente (así una prueba le pasa uno simulado). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProfileClient = Pick<SupabaseClient<any>, 'from'>

/** Qué hay detrás de una sesión ya verificada. */
export type SessionLookup =
  | { status: 'ok'; user: SessionUser }
  /** Tiene cuenta de acceso pero ninguna fila en `profiles` (un alta que no se completó). */
  | { status: 'sin-perfil' }
  /** La consulta falló: no se sabe quién es. */
  | { status: 'error'; message: string }

/** El perfil y los módulos otorgados de quien ya está autenticado (`userId` verificado). El embed trae los módulos
 *  en la misma consulta (un solo viaje; profile_module_grants tiene su propia RLS que permite leer solo las
 *  filas propias). Distingue «no tiene perfil» de «la consulta falló». */
export async function loadSessionUser(supabase: ProfileClient, userId: string): Promise<SessionLookup> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, nombre, correo, profile_module_grants!profile_module_grants_profile_id_fkey(module_key)')
    .eq('id', userId)
    .maybeSingle()

  if (error) return { status: 'error', message: error.message }
  if (!profile) return { status: 'sin-perfil' }

  return {
    status: 'ok',
    user: {
      id: userId,
      email: profile.correo,
      role: profile.role as Role,
      nombre: profile.nombre,
      permissions: resolvePermissionsFromGrants(profile.role as Role, profile.profile_module_grants),
    },
  }
}
