import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/auth/session'
import { getSupabaseServer } from '@/lib/supabase/server'
import { loadPipelineSessions } from '@/lib/deliverables/sessions'
import { EntregablesHub } from '@/components/portal/entregables-hub'

export default async function SuperEntregablesPage() {
  const user = await requirePermission('therapy:create')
  if (user.role !== 'super_admin') redirect('/admin/entregables')
  const sessions = await loadPipelineSessions(getSupabaseServer(), user)
  return <EntregablesHub basePath="/super/entregables" sessions={sessions} />
}
