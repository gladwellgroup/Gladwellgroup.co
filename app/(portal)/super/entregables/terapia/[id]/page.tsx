import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/auth/session'
import { getSupabaseServer } from '@/lib/supabase/server'
import { SessionDetailForm } from '@/components/portal/session-detail-form'
import { resolvePermissionsFromGrants, type Role } from '@/lib/permissions'

export default async function SuperEntregableDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requirePermission('sessions:read_community')
  if (user.role !== 'super_admin') notFound()
  const { id } = await params
  const supabase = getSupabaseServer()

  const [{ data }, { data: communityAdmins }] = await Promise.all([
    supabase
      .from('therapy_sessions')
      .select(`
        id, title, session_date, moderator_id, pillar, status, created_by, invitado_id, co_admin_ids,
        therapy_session_inputs ( reto_problema, recomendaciones_incomodas, foto_sesion_url, frase_texto, frase_autor ),
        therapy_session_cofounders ( id, nombre, whatsapp, correo, orden ),
        therapy_session_audios ( id, audio_url, autor_nombre, duracion_segundos, created_at ),
        therapy_deliverables ( id ),
        invitados ( id, nombre, descripcion, red_social, pagina_web ),
        therapy_session_attendees ( id, nombre, correo, email_status, email_error, source, created_at ),
        session_attendance_links ( token, expires_at )
      `)
      .eq('id', id)
      .order('orden', { referencedTable: 'therapy_session_cofounders' })
      .order('created_at', { referencedTable: 'therapy_session_audios' })
      .order('created_at', { referencedTable: 'therapy_session_attendees' })
      .single(),
    supabase
      .from('profiles')
      .select('id, nombre, role, profile_module_grants!profile_module_grants_profile_id_fkey(module_key)')
      .eq('role', 'community_admin')
      .order('nombre'),
  ])

  if (!data) notFound()

  // Solo ofrecer como coadministrador a quien la API ya aceptaría — sin
  // esto el selector deja marcar a cualquier community_admin y el PATCH
  // rechaza en silencio a los que no tienen el módulo de Terapia.
  const eligibleCoAdmins = (communityAdmins ?? []).filter((admin) =>
    resolvePermissionsFromGrants(admin.role as Role, admin.profile_module_grants).includes(
      'therapy:create'
    )
  )

  // supabase-js tipa las relaciones embebidas como arrays, pero en runtime
  // las to-one (inputs/deliverable/invitado, con FK o session_id UNIQUE)
  // vuelven objeto|null. El cliente ya es <any>, así que desestructuramos
  // desde any.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: any = data
  const {
    therapy_session_inputs: inputs,
    therapy_session_cofounders: cofounders,
    therapy_session_audios: audios,
    therapy_deliverables: deliverable,
    invitados: invitado,
    therapy_session_attendees: attendees,
    session_attendance_links: attendanceLinks,
    co_admin_ids: coAdminIds,
    ...session
  } = row

  return (
    <SessionDetailForm
      session={session}
      inputs={inputs}
      invitado={invitado ?? null}
      cofounders={cofounders ?? []}
      audios={audios ?? []}
      attendees={attendees ?? []}
      attendanceLink={attendanceLinks?.[0] ?? null}
      basePath="/super/entregables/terapia"
      hasDeliverable={Boolean(deliverable)}
      coAdminIds={coAdminIds ?? []}
      communityAdmins={eligibleCoAdmins}
    />
  )
}
