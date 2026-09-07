import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/auth/session'
import { listEducationSessions } from '@/lib/education/queries'
import { EducationDashboard } from '@/components/portal/education-dashboard'

export default async function SuperEducationPage() {
  const user = await requirePermission('sessions:read_community')
  if (user.role !== 'super_admin') redirect('/admin/entregables/education')

  const { sessions, admins } = await listEducationSessions()

  return (
    <EducationDashboard
      sessions={sessions}
      admins={admins}
      currentUserId={user.id}
      canAssignAdmin
      canCreate={user.permissions.includes('education:create')}
      basePath="/super/entregables/education"
      hubPath="/super/entregables"
    />
  )
}
