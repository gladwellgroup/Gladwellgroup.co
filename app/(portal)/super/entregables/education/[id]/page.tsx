import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/auth/session'
import {
  canAccessEducationSession,
  getEducationSession,
} from '@/lib/education/queries'
import { EducationSessionForm } from '@/components/portal/education-session-form'

export default async function SuperEducationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requirePermission('education:create')
  if (user.role !== 'super_admin') notFound()

  const { id } = await params
  const data = await getEducationSession(id)

  if (!data) notFound()
  if (!canAccessEducationSession(data.session, user)) notFound()

  return (
    <EducationSessionForm
      session={data.session}
      inputs={data.inputs}
      tools={data.tools}
      attendees={data.attendees}
      attendanceLink={data.attendanceLink}
      basePath="/super/entregables/education"
      hasDeliverable={Boolean(data.deliverable)}
    />
  )
}
