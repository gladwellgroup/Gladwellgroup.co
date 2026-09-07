import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/auth/session'
import { getSupabaseServer } from '@/lib/supabase/server'
import { loadPipelineSessions } from '@/lib/deliverables/sessions'
import { EntregablesHub } from '@/components/portal/entregables-hub'

export default async function SuperEntregablesPage() {
  const user = await requirePermission('sessions:read_community')
  if (user.role !== 'super_admin') redirect('/admin/entregables')
  const sessions = await loadPipelineSessions(getSupabaseServer(), user, 'all')
  return (
    <EntregablesHub
      basePath="/super/entregables"
      sessions={sessions}
      canManageTherapy
      canManageEducation
    />
  )
}
