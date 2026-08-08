import { requirePermission } from '@/lib/auth/session'
import { listEducationSessions } from '@/lib/education/queries'
import { EducationDashboard } from '@/components/portal/education-dashboard'

export default async function AdminEducationPage() {
  const user = await requirePermission('education:create')
  const { sessions, admins } = await listEducationSessions({
    userId: user.id,
    role: user.role,
  })

  return (
    <EducationDashboard
      sessions={sessions}
      admins={admins}
      currentUserId={user.id}
      canAssignAdmin={false}
      basePath="/admin/entregables/education"
      hubPath="/admin/entregables"
    />
  )
}
