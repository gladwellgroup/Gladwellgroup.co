import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadSessionUser } from '@/lib/auth/session-user'
import { ACCESS_UNAVAILABLE_MESSAGE } from '@/lib/auth/unavailable'
import { parseDateOnly } from '@/lib/date'
import { isQueryFailure } from '@/lib/supabase/must'

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

/** La base no contestó: no se sabe si la persona puede entrar ni si la sesión existe. */
function unavailable(): DeliverableAccess {
  return {
    allowed: false,
    isModeratorOrSuper: false,
    isCreatorModeratorOrSuper: false,
    role: null,
    session: null,
    error: ACCESS_UNAVAILABLE_MESSAGE,
    statusCode: 503,
  }
}

export async function resolveDeliverableAccess(
  supabase: SupabaseClient,
  user: User,
  sessionId: string
): Promise<DeliverableAccess> {
  const lookup = await loadSessionUser(supabase, user.id)
  // Una consulta caída NO es «Sin permisos» ni «Sesión no encontrada»: 503, reintentable.
  if (lookup.status === 'error') return unavailable()
  const profile = lookup.status === 'ok' ? lookup.user : null

  // 'therapy:create' es el permiso que otorga el módulo Encuentros ·
  // Terapia — revocarlo debe cortar el acceso real a estas rutas, no solo
  // el ítem del menú (antes esto solo miraba el rol a secas).
  if (!profile || !profile.permissions.includes('therapy:create')) {
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

  const { data: sessionRow, error: sessionError } = await supabase
    .from('therapy_sessions')
    .select(
      'id, title, session_date, moderator_id, status, created_by, co_admin_ids, invitados ( nombre )'
    )
    .eq('id', sessionId)
    .maybeSingle()

  if (isQueryFailure(sessionError)) return unavailable()

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

  // Un coadministrador (designado por el super_admin después de creada la
  // sesión) cuenta como si fuera el moderador — acceso total, no solo
  // lectura de contacto.
  const isCoAdmin: boolean = (session.co_admin_ids ?? []).includes(user.id)
  const isModeratorOrSuper =
    profile.role === 'super_admin' || user.id === session.moderator_id || isCoAdmin
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
