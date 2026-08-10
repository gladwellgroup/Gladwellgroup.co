import { requirePermission } from '@/lib/auth/session'
import { getSupabaseServer } from '@/lib/supabase/server'
import { loadPipelineSessions } from '@/lib/deliverables/sessions'
import { EntregablesHub } from '@/components/portal/entregables-hub'

export default async function AdminEntregablesPage() {
  const user = await requirePermission('therapy:create')
  const sessions = await loadPipelineSessions(getSupabaseServer(), user)
  return <EntregablesHub basePath="/admin/entregables" sessions={sessions} />
}
