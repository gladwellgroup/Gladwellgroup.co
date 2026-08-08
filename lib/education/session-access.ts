import type { SupabaseClient, User } from '@supabase/supabase-js'

export type EducationAccess = {
  allowed: boolean
  /** Super admin, o el administrador de comunidad asignado / creador. */
  isAdminOrSuper: boolean
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

/** El cliente server usa la service role key, que ignora RLS por completo:
 *  esta función es la autorización real de todas las rutas de Education. */
export async function resolveEducationAccess(
  supabase: SupabaseClient,
  user: User,
  sessionId: string
): Promise<EducationAccess> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['super_admin', 'community_admin'].includes(profile.role)) {
    return {
      allowed: false,
      isAdminOrSuper: false,
      role: profile?.role ?? null,
      session: null,
      error: 'Sin permisos',
      statusCode: 403,
    }
  }

  const { data: session } = await supabase
    .from('education_sessions')
    .select('id, title, session_date, admin_id, status, created_by')
    .eq('id', sessionId)
    .single()

  if (!session) {
    return {
      allowed: false,
      isAdminOrSuper: false,
      role: profile.role,
      session: null,
      error: 'Sesión no encontrada',
      statusCode: 404,
    }
  }

  const isAdminOrSuper =
    profile.role === 'super_admin' ||
    user.id === session.admin_id ||
    user.id === session.created_by

  if (!isAdminOrSuper) {
    return {
      allowed: false,
      isAdminOrSuper: false,
      role: profile.role,
      session: null,
      error: 'Sin permisos sobre esta sesión',
      statusCode: 403,
    }
  }

  return { allowed: true, isAdminOrSuper, role: profile.role, session }
}
