import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/auth/session'
import { listCharlas } from '@/lib/charlas/queries'
import { CharlasDashboard } from '@/components/portal/charlas-dashboard'

export default async function SuperCharlasPage() {
  const user = await requirePermission('sessions:read_community')
  if (user.role !== 'super_admin') redirect('/admin/encuentros/charlas')

  const charlas = await listCharlas()

  return (
    <CharlasDashboard
      charlas={charlas}
      canCreate={user.permissions.includes('charlas:manage')}
      basePath="/super/encuentros/charlas"
      hubPath="/super/encuentros"
    />
  )
}
