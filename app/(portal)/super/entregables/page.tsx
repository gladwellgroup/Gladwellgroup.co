import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/auth/session'
import { EntregablesHub } from '@/components/portal/entregables-hub'

export default async function SuperEntregablesPage() {
  const user = await requirePermission('therapy:create')
  if (user.role !== 'super_admin') redirect('/admin/entregables')
  return <EntregablesHub basePath="/super/entregables" />
}
