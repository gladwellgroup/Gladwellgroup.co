import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/auth/session'
import { listEducationSessions } from '@/lib/education/queries'
import { EducationDashboard } from '@/components/portal/education-dashboard'

export default async function SuperEducationPage() {
  const user = await requirePermission('education:create')
  if (user.role !== 'super_admin') redirect('/admin/entregables/education')

  const { sessions, admins } = await listEducationSessions({
    userId: user.id,
    role: user.role,
  })

  return (
    <EducationDashboard
      sessions={sessions}
      admins={admins}
      currentUserId={user.id}
      canAssignAdmin
      basePath="/super/entregables/education"
      hubPath="/super/entregables"
    />
  )
}
