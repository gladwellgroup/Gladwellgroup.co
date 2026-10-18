import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/auth/session'
import { getSupabaseServer } from '@/lib/supabase/server'
import { loadCalendarSessions } from '@/lib/deliverables/sessions'
import { EncuentrosHub } from '@/components/portal/encuentros-hub'

export default async function SuperEncuentrosPage() {
  const user = await requirePermission('sessions:read_community')
  if (user.role !== 'super_admin') redirect('/admin/encuentros')
  const sessions = await loadCalendarSessions(getSupabaseServer(), user)
  return (
    <EncuentrosHub
      basePath="/super/encuentros"
      sessions={sessions}
      canManageTherapy
      canManageEducation
      canManageCharlas
    />
  )
}
