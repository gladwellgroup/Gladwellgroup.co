import { requirePermission } from '@/lib/auth/session'
import { listEducationSessions } from '@/lib/education/queries'
import { EducationDashboard } from '@/components/portal/education-dashboard'

export default async function AdminEducationPage() {
  const user = await requirePermission('sessions:read_community')
  const canCreate = user.permissions.includes('education:create')
  const { sessions, admins } = await listEducationSessions(canCreate)

  return (
    <EducationDashboard
      sessions={sessions}
      admins={admins}
      currentUserId={user.id}
      canAssignAdmin={false}
      canCreate={canCreate}
      basePath="/admin/entregables/education"
      hubPath="/admin/entregables"
    />
  )
}
