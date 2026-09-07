import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/auth/session'
import { getSupabaseServer } from '@/lib/supabase/server'
import { SessionDetailForm } from '@/components/portal/session-detail-form'

export default async function AdminEntregableDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requirePermission('sessions:read_community')
  const { id } = await params
  const supabase = getSupabaseServer()

  const { data } = await supabase
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
    .single()

  if (!data) notFound()

  const isCreator = data.created_by === user.id
  const isModerator = data.moderator_id === user.id
  const isCoAdmin = (data.co_admin_ids ?? []).includes(user.id)
  const isOwner = isCreator || isModerator || isCoAdmin
  const canViewContact = isOwner
  // Más restrictivo que canViewContact a propósito: un creador que no es el
  // moderador (ni coadministrador) nunca vio esto, ni siquiera antes de que
  // existiera el módulo de solo lectura — se mantiene esa regla.
  const canSeeRecomendaciones = isModerator || isCoAdmin

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
    ...session
  } = row

  // Redacción del lado del servidor: si no puede ver contacto, el
  // WhatsApp/correo real nunca sale de acá — el resto de cada fila
  // (nombre, estado, origen, hora) viaja intacto, la tabla se ve completa.
  const visibleCofounders = canViewContact
    ? (cofounders ?? [])
    : (cofounders ?? []).map((c: { whatsapp: string | null; correo: string | null }) => ({
        ...c,
        whatsapp: null,
        correo: '',
      }))
  const visibleAttendees = canViewContact
    ? (attendees ?? [])
    : (attendees ?? []).map((a: { correo: string }) => ({ ...a, correo: '' }))
  // Igual que con el contacto: si no puede verlas, el texto real de
  // "Recomendaciones incómodas" nunca sale de acá, aunque el acordeón que
  // lo muestra ya esté oculto del lado del cliente — no basta con no
  // renderizarlo, el valor no debe viajar en el payload.
  const visibleInputs = inputs && !canSeeRecomendaciones
    ? { ...inputs, recomendaciones_incomodas: null }
    : inputs

  // "Audio de la comunidad" es el equivalente hablado de "Recomendaciones
  // incómodas" — misma restricción, mismo motivo: no basta con ocultar el
  // reproductor del lado del cliente, la URL real no debe viajar en el
  // payload para quien no puede escucharla.
  const visibleAudios = canSeeRecomendaciones
    ? (audios ?? [])
    : (audios ?? []).map((a: { audio_url: string }) => ({ ...a, audio_url: '' }))

  return (
    <SessionDetailForm
      session={session}
      inputs={visibleInputs}
      invitado={invitado ?? null}
      cofounders={visibleCofounders}
      audios={visibleAudios}
      attendees={visibleAttendees}
      attendanceLink={attendanceLinks?.[0] ?? null}
      basePath="/admin/entregables/terapia"
      hasDeliverable={Boolean(deliverable)}
      canEdit={isOwner}
      hideContact={!canViewContact}
      canEditRecomendaciones={canSeeRecomendaciones}
    />
  )
}
