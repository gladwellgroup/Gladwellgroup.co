import { requirePermission } from '@/lib/auth/session'
import { EntregablesHub } from '@/components/portal/entregables-hub'

export default async function AdminEntregablesPage() {
  await requirePermission('therapy:create')
  return <EntregablesHub basePath="/admin/entregables" />
}
