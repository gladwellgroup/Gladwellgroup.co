import type { SupabaseClient, User } from '@supabase/supabase-js'
import { loadSessionUser } from '@/lib/auth/session-user'
import { ACCESS_UNAVAILABLE_MESSAGE } from '@/lib/auth/unavailable'
import type { CharlaFields } from '@/lib/charlas/types'
import { isQueryFailure } from '@/lib/supabase/must'
import type { Role } from '@/lib/permissions/roles'

export type CharlaAccess =
  | { allowed: true; role: Role; charla: CharlaFields }
  | { allowed: false; error: string; statusCode: number }

/** La base no contestó: no se sabe si la persona puede entrar ni si la charla existe. */
const UNAVAILABLE: CharlaAccess = {
  allowed: false,
  error: ACCESS_UNAVAILABLE_MESSAGE,
  statusCode: 503,
}

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
  const lookup = await loadSessionUser(supabase, user.id)
  // Una consulta caída NO es «Sin permisos» ni «Charla no encontrada»: 503, reintentable.
  if (lookup.status === 'error') return UNAVAILABLE
  const profile = lookup.status === 'ok' ? lookup.user : null

  if (!profile || !profile.permissions.includes('charlas:manage')) {
    return { allowed: false, error: 'Sin permisos', statusCode: 403 }
  }

  const { data: charla, error: charlaError } = await supabase
    .from('charlas')
    .select('id, title, session_date, photo_url')
    .eq('id', charlaId)
    .maybeSingle()

  if (isQueryFailure(charlaError)) return UNAVAILABLE

  if (!charla) {
    return { allowed: false, error: 'Charla no encontrada', statusCode: 404 }
  }

  return { allowed: true, role: profile.role, charla: charla as CharlaFields }
}
