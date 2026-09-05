import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseDateOnly } from '@/lib/date'
import { resolvePermissionsFromGrants } from '@/lib/permissions/resolve'
import type { Role } from '@/lib/permissions/roles'

export type DeliverableAccess = {
  allowed: boolean
  isModeratorOrSuper: boolean
  isCreatorModeratorOrSuper: boolean
  role: string | null
  session: {
    id: string
    title: string
    session_date: string
    moderator_id: string
    status: string
    created_by: string
    invitadoNombre: string | null
  } | null
  error?: string
  statusCode?: number
}

export async function resolveDeliverableAccess(
  supabase: SupabaseClient,
  user: User,
  sessionId: string
): Promise<DeliverableAccess> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, profile_module_grants!profile_module_grants_profile_id_fkey(module_key)')
    .eq('id', user.id)
    .single()

  const permissions = profile
    ? resolvePermissionsFromGrants(profile.role as Role, profile.profile_module_grants)
    : []

  // 'therapy:create' es el permiso que otorga el módulo Entregables ·
  // Terapia — revocarlo debe cortar el acceso real a estas rutas, no solo
  // el ítem del menú (antes esto solo miraba el rol a secas).
  if (!profile || !permissions.includes('therapy:create')) {
    return {
      allowed: false,
      isModeratorOrSuper: false,
      isCreatorModeratorOrSuper: false,
      role: profile?.role ?? null,
      session: null,
      error: 'Sin permisos',
      statusCode: 403,
    }
  }

  const { data: sessionRow } = await supabase
    .from('therapy_sessions')
    .select(
      'id, title, session_date, moderator_id, status, created_by, invitados ( nombre )'
    )
    .eq('id', sessionId)
    .single()

  if (!sessionRow) {
    return {
      allowed: false,
      isModeratorOrSuper: false,
      isCreatorModeratorOrSuper: false,
      role: profile.role,
      session: null,
      error: 'Sesión no encontrada',
      statusCode: 404,
    }
  }

  // supabase-js tipa la relación invitados como array; en runtime es un
  // objeto|null (FK hacia adelante). Cliente <any>.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { invitados, ...session } = sessionRow as any
  const invitadoNombre: string | null = invitados?.nombre ?? null

  const isModeratorOrSuper =
    profile.role === 'super_admin' || user.id === session.moderator_id
  const isCreatorModeratorOrSuper =
    isModeratorOrSuper || user.id === session.created_by

  return {
    allowed: true,
    isModeratorOrSuper,
    isCreatorModeratorOrSuper,
    role: profile.role,
    session: { ...session, invitadoNombre },
  }
}

export function formatSessionDate(date: string): string {
  try {
    return parseDateOnly(date).toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return date
  }
}
