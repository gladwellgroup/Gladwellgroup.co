import type { SupabaseClient, User } from '@supabase/supabase-js'
import { loadSessionUser } from '@/lib/auth/session-user'
import { ACCESS_UNAVAILABLE_MESSAGE } from '@/lib/auth/unavailable'
import { isQueryFailure } from '@/lib/supabase/must'

export type EducationAccess = {
  allowed: boolean
  /** Super admin, o el administrador de comunidad asignado / creador. */
  isAdminOrSuper: boolean
  /** Más restrictivo que isAdminOrSuper a propósito: excluye al creador
   *  puro. Gatea contenido sensible (notas del moderador, transcripción,
   *  audio) — mismo criterio que isModeratorOrSuper en Terapia para
   *  recomendaciones_incomodas. */
  isAdminOrCoAdminOrSuper: boolean
  role: string | null
  session: {
    id: string
    title: string
    session_date: string
    admin_id: string
    status: string
    created_by: string
  } | null
  error?: string
  statusCode?: number
}

/** La base no contestó: no se sabe si la persona puede entrar ni si la sesión existe. */
function unavailable(): EducationAccess {
  return {
    allowed: false,
    isAdminOrSuper: false,
    isAdminOrCoAdminOrSuper: false,
    role: null,
    session: null,
    error: ACCESS_UNAVAILABLE_MESSAGE,
    statusCode: 503,
  }
}

/** El cliente server usa la service role key, que ignora RLS por completo:
 *  esta función es la autorización real de todas las rutas de Education. */
export async function resolveEducationAccess(
  supabase: SupabaseClient,
  user: User,
  sessionId: string
): Promise<EducationAccess> {
  const lookup = await loadSessionUser(supabase, user.id)
  // Una consulta caída NO es «Sin permisos» ni «Sesión no encontrada»: 503, reintentable.
  if (lookup.status === 'error') return unavailable()
  const profile = lookup.status === 'ok' ? lookup.user : null

  // 'education:create' es el permiso que otorga el módulo Encuentros ·
  // Educación — revocarlo debe cortar el acceso real a estas rutas, no
  // solo el ítem del menú (antes esto solo miraba el rol a secas).
  if (!profile || !profile.permissions.includes('education:create')) {
    return {
      allowed: false,
      isAdminOrSuper: false,
      isAdminOrCoAdminOrSuper: false,
      role: profile?.role ?? null,
      session: null,
      error: 'Sin permisos',
      statusCode: 403,
    }
  }

  const { data: session, error: sessionError } = await supabase
    .from('education_sessions')
    .select('id, title, session_date, admin_id, status, created_by, co_admin_ids')
    .eq('id', sessionId)
    .maybeSingle()

  if (isQueryFailure(sessionError)) return unavailable()

  if (!session) {
    return {
      allowed: false,
      isAdminOrSuper: false,
      isAdminOrCoAdminOrSuper: false,
      role: profile.role,
      session: null,
      error: 'Sesión no encontrada',
      statusCode: 404,
    }
  }

  const isCoAdmin = (session.co_admin_ids ?? []).includes(user.id)
  // Un coadministrador (designado por el super_admin después de creada la
  // sesión) cuenta como si fuera el admin responsable — acceso total.
  const isAdminOrSuper =
    profile.role === 'super_admin' ||
    user.id === session.admin_id ||
    user.id === session.created_by ||
    isCoAdmin
  // Excluye al creador puro a propósito — ver comentario en el tipo.
  const isAdminOrCoAdminOrSuper =
    profile.role === 'super_admin' || user.id === session.admin_id || isCoAdmin

  if (!isAdminOrSuper) {
    return {
      allowed: false,
      isAdminOrSuper: false,
      isAdminOrCoAdminOrSuper: false,
      role: profile.role,
      session: null,
      error: 'Sin permisos sobre esta sesión',
      statusCode: 403,
    }
  }

  return {
    allowed: true,
    isAdminOrSuper,
    isAdminOrCoAdminOrSuper,
    role: profile.role,
    session,
  }
}
