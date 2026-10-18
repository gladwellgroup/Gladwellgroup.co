import { requirePermission } from '@/lib/auth/session'
import { listCharlas } from '@/lib/charlas/queries'
import { CharlasDashboard } from '@/components/portal/charlas-dashboard'

export default async function AdminCharlasPage() {
  const user = await requirePermission('sessions:read_community')
  const charlas = await listCharlas()

  return (
    <CharlasDashboard
      charlas={charlas}
      canCreate={user.permissions.includes('charlas:manage')}
      basePath="/admin/encuentros/charlas"
      hubPath="/admin/encuentros"
    />
  )
}
