import type { SupabaseClient } from '@supabase/supabase-js'
import type { SessionUser } from '@/lib/auth/session'

export type Programa = 'terapia' | 'education'

export interface CalendarSession {
  id: string
  title: string
  session_date: string
  status: string | null
  programa: Programa
  /** Empresa (Terapia) o ponente (Education); null si aún no se ha llenado. */
  subtitulo: string | null
  /** Moderador (Terapia) o administrador (Education) responsable de la
   *  sesión — quién debe destrabarla si queda estancada. */
  responsable: string | null
}

/** El listado de cada programa solo muestra las sesiones propias de un
 *  community_admin; cualquier vista que combine ambos programas tiene que
 *  acotar igual o mostraría conteos y títulos de sesiones que esa persona no
 *  puede abrir. El cliente server usa la service role key e ignora RLS, así
 *  que este filtro es la única barrera — por eso vive en un solo sitio en vez
 *  de reescribirse en cada pantalla que combine Terapia y Education. */
function scopeToOwner<T>(
  query: T,
  user: SessionUser,
  ownerColumn: 'moderator_id' | 'admin_id'
): T {
  if (user.role === 'super_admin') return query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (query as any).or(
    `created_by.eq.${user.id},${ownerColumn}.eq.${user.id}`
  )
}

// supabase-js tipa las relaciones embebidas como arrays; en runtime son
// objeto|null (invitado_id y session_id en education_session_inputs son FKs
// a-uno, no a-muchos).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EmbeddedRow = any

/** Sesiones de Terapia y Education combinadas, acotadas por pertenencia y con
 *  el dato que identifica a cada una según su categoría — empresa invitada o
 *  ponente. Fuente única para el dashboard y el calendario de Entregables: si
 *  cada pantalla escribiera su propio filtro de alcance, sería fácil que una
 *  quedara desactualizada mientras la otra se corrige. */
export async function loadPipelineSessions(
  supabase: SupabaseClient,
  user: SessionUser
): Promise<CalendarSession[]> {
  // `profiles!moderator_id` / `profiles!admin_id`: therapy_sessions y
  // education_sessions tienen una SEGUNDA FK hacia profiles (created_by), así
  // que un embed `profiles(nombre)` sin desambiguar es ambiguo para PostgREST
  // y la consulta falla — hay que decirle explícitamente por cuál columna.
  const [terapia, education] = await Promise.all([
    scopeToOwner(
      supabase
        .from('therapy_sessions')
        .select(
          'id, title, session_date, status, invitados ( nombre ), profiles!moderator_id ( nombre )'
        ),
      user,
      'moderator_id'
    ),
    scopeToOwner(
      supabase
        .from('education_sessions')
        .select(
          'id, title, session_date, status, education_session_inputs ( ponente_nombre ), profiles!admin_id ( nombre )'
        ),
      user,
      'admin_id'
    ),
  ])

  const terapiaSessions: CalendarSession[] = ((terapia.data ?? []) as EmbeddedRow[]).map(
    (s) => ({
      id: s.id,
      title: s.title,
      session_date: s.session_date,
      status: s.status,
      programa: 'terapia' as const,
      subtitulo: s.invitados?.nombre ?? null,
      responsable: s.profiles?.nombre ?? null,
    })
  )

  const educationSessions: CalendarSession[] = (
    (education.data ?? []) as EmbeddedRow[]
  ).map((s) => ({
    id: s.id,
    title: s.title,
    session_date: s.session_date,
    status: s.status,
    programa: 'education' as const,
    subtitulo: s.education_session_inputs?.ponente_nombre ?? null,
    responsable: s.profiles?.nombre ?? null,
  }))

  return [...terapiaSessions, ...educationSessions]
}
