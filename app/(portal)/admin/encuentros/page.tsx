import { requirePermission } from '@/lib/auth/session'
import { getSupabaseServer } from '@/lib/supabase/server'
import { loadCalendarSessions } from '@/lib/deliverables/sessions'
import { EncuentrosHub } from '@/components/portal/encuentros-hub'

export default async function AdminEncuentrosPage() {
  const user = await requirePermission('sessions:read_community')
  const sessions = await loadCalendarSessions(getSupabaseServer(), user)
  return (
    <EncuentrosHub
      basePath="/admin/encuentros"
      sessions={sessions}
      canManageTherapy={user.permissions.includes('therapy:create')}
      canManageEducation={user.permissions.includes('education:create')}
      canManageCharlas={user.permissions.includes('charlas:manage')}
    />
  )
}
