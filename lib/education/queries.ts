import { getSupabaseServer } from '@/lib/supabase/server'
import type { Role } from '@/lib/permissions/roles'

/** Los árboles /admin y /super comparten esta consulta y su basePath. Antes
 *  acotaba a "propias" para quien no fuera super_admin, pero ambas páginas
 *  que la llaman ya están detrás de `sessions:read_community` — quien llega
 *  hasta acá ya puede ver toda la comunidad, así que lista siempre todo.
 *
 *  `includeAdmins` (default true, lo que necesita /super) — el listado de
 *  admins (nombre + correo de cada super_admin/community_admin) solo lo usa
 *  el selector del formulario "Nueva sesión"; /admin lo pide en false cuando
 *  el viewer no puede crear, para no filtrar el correo de todo el equipo a
 *  un payload que nunca lo va a mostrar. */
export async function listEducationSessions(includeAdmins: boolean = true) {
  const supabase = getSupabaseServer()

  const [{ data: sessions }, { data: admins }] = await Promise.all([
    supabase
      .from('education_sessions')
      .select('*, education_session_inputs ( ponente_nombre )')
      .order('created_at', { ascending: false }),
    includeAdmins
      ? supabase
          .from('profiles')
          .select('id, nombre, correo')
          .in('role', ['super_admin', 'community_admin'])
          .order('nombre')
      : Promise.resolve({ data: [] }),
  ])

  // supabase-js tipa las relaciones embebidas como arrays; en runtime una
  // relación to-one (session_id UNIQUE) vuelve objeto|null.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (sessions ?? []) as any[]

  return { sessions: rows, admins: admins ?? [] }
}

export async function getEducationSession(id: string) {
  const supabase = getSupabaseServer()

  const { data } = await supabase
    .from('education_sessions')
    .select(
      `
      id, title, session_date, admin_id, status, created_by, co_admin_ids,
      education_session_inputs (
        ponente_nombre, ponente_rol, ponente_foto_url, ponente_red_social,
        descripcion_sesion, objetivo, notas_moderador,
        frase_texto, frase_autor, capsulas_emprendimiento,
        foto_sesion_url, transcripcion_texto, audio_url
      ),
      education_tools ( nombre, descripcion, url, orden ),
      education_attendees ( id, nombre, correo, empresa, email_status, email_error, source ),
      education_deliverables (
        id, conclusiones_clave, capsulas, content_html,
        pdf_url, processing_status, generated_at
      ),
      session_attendance_links ( token, expires_at )
    `
    )
    .eq('id', id)
    .order('orden', { referencedTable: 'education_tools' })
    .order('created_at', { referencedTable: 'education_attendees' })
    .single()

  if (!data) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: any = data
  const {
    education_session_inputs: inputs,
    education_tools: tools,
    education_attendees: attendees,
    education_deliverables: deliverable,
    session_attendance_links: attendanceLinks,
    ...session
  } = row

  return {
    session,
    inputs: inputs ?? null,
    tools: tools ?? [],
    attendees: attendees ?? [],
    deliverable: deliverable ?? null,
    attendanceLink: attendanceLinks?.[0] ?? null,
  }
}

/** Un community_admin solo entra a las sesiones que creó, que le asignaron,
 *  o donde el super_admin lo puso como coadministrador después de creada. */
export function canAccessEducationSession(
  session: { admin_id: string; created_by: string; co_admin_ids?: string[] | null },
  user: { id: string; role: Role }
): boolean {
  return (
    user.role === 'super_admin' ||
    session.admin_id === user.id ||
    session.created_by === user.id ||
    (session.co_admin_ids ?? []).includes(user.id)
  )
}
