import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { CharlaFields } from '@/lib/charlas/types'
import { resolvePermissionsFromGrants } from '@/lib/permissions/resolve'
import type { Role } from '@/lib/permissions/roles'

export type CharlaAccess =
  | { allowed: true; role: Role; charla: CharlaFields }
  | { allowed: false; error: string; statusCode: number }

/** El cliente server usa la service role key, que ignora RLS por completo:
 *  esta función es la autorización real de las rutas de Charlas.
 *
 *  A diferencia de Terapia y Education no hay un «responsable» por charla: quien
 *  tiene el módulo `charlas` (permiso `charlas:manage`) gestiona todas. Revocar
 *  el módulo corta el acceso real a estas rutas, no solo el ítem del menú. */
export async function resolveCharlaAccess(
  supabase: SupabaseClient,
  user: User,
  charlaId: string
): Promise<CharlaAccess> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, profile_module_grants!profile_module_grants_profile_id_fkey(module_key)')
    .eq('id', user.id)
    .single()

  const permissions = profile
    ? resolvePermissionsFromGrants(profile.role as Role, profile.profile_module_grants)
    : []

  if (!profile || !permissions.includes('charlas:manage')) {
    return { allowed: false, error: 'Sin permisos', statusCode: 403 }
  }

  const { data: charla } = await supabase
    .from('charlas')
    .select('id, title, session_date, photo_url')
    .eq('id', charlaId)
    .single()

  if (!charla) {
    return { allowed: false, error: 'Charla no encontrada', statusCode: 404 }
  }

  return { allowed: true, role: profile.role as Role, charla: charla as CharlaFields }
}
