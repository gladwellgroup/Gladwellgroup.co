import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/auth/session'
import {
  canAccessEducationSession,
  getEducationSession,
} from '@/lib/education/queries'
import { EducationSessionForm } from '@/components/portal/education-session-form'

export default async function AdminEducationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requirePermission('sessions:read_community')
  const { id } = await params
  const data = await getEducationSession(id)

  if (!data) notFound()

  const isOwner = canAccessEducationSession(data.session, user)
  const canViewContact = isOwner
  const isAdmin = data.session.admin_id === user.id
  const isCoAdmin = (data.session.co_admin_ids ?? []).includes(user.id)
  // Más restrictivo que isOwner a propósito: un creador que no es el
  // admin_id (ni coadministrador) no ve notas del moderador, transcripción
  // ni audio — mismo criterio que recomendaciones_incomodas en Terapia.
  const canSeeNotas = isAdmin || isCoAdmin

  // Redacción del lado del servidor: si no puede ver contacto, el correo
  // real nunca sale de acá — el resto de cada fila (nombre, empresa,
  // estado, origen) viaja intacto, la tabla se ve completa.
  const visibleAttendees = canViewContact
    ? data.attendees
    : data.attendees.map((a: { correo: string }) => ({ ...a, correo: '' }))

  // Igual que con el contacto: si no puede verlas, el texto/audio real
  // nunca sale de acá, aunque el acordeón que los muestra ya esté oculto
  // del lado del cliente — no basta con no renderizarlo.
  const visibleInputs =
    data.inputs && !canSeeNotas
      ? {
          ...data.inputs,
          notas_moderador: null,
          transcripcion_texto: null,
          audio_url: null,
        }
      : data.inputs

  return (
    <EducationSessionForm
      session={data.session}
      inputs={visibleInputs}
      tools={data.tools}
      attendees={visibleAttendees}
      attendanceLink={data.attendanceLink}
      basePath="/admin/entregables/education"
      hasDeliverable={Boolean(data.deliverable)}
      canEdit={isOwner}
      hideContact={!canViewContact}
      canSeeNotas={canSeeNotas}
    />
  )
}
