import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/auth/session'
import {
  canAccessEducationSession,
  getEducationSession,
} from '@/lib/education/queries'
import { EducationDeliverableEditor } from '@/components/portal/education-deliverable-editor'

export default async function AdminEducationDeliverablePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requirePermission('education:create')
  const { id } = await params
  const data = await getEducationSession(id)

  if (!data) notFound()
  if (!canAccessEducationSession(data.session, user)) notFound()
  if (!data.deliverable) notFound()

  return (
    <EducationDeliverableEditor
      session={data.session}
      deliverable={data.deliverable}
      fotoSesionUrl={data.inputs?.foto_sesion_url ?? null}
      attendeesPendientes={
        data.attendees.filter(
          (a: { email_status: string }) => a.email_status !== 'enviado'
        ).length
      }
      attendeesFallidos={
        data.attendees.filter(
          (a: { email_status: string }) => a.email_status === 'error'
        ).length
      }
      basePath="/admin/entregables/education"
    />
  )
}
