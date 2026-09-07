import { requirePermission } from '@/lib/auth/session'
import { getSupabaseServer } from '@/lib/supabase/server'
import { loadPipelineSessions } from '@/lib/deliverables/sessions'
import { EntregablesHub } from '@/components/portal/entregables-hub'

export default async function AdminEntregablesPage() {
  const user = await requirePermission('sessions:read_community')
  const sessions = await loadPipelineSessions(getSupabaseServer(), user, 'all')
  return (
    <EntregablesHub
      basePath="/admin/entregables"
      sessions={sessions}
      canManageTherapy={user.permissions.includes('therapy:create')}
      canManageEducation={user.permissions.includes('education:create')}
    />
  )
}
