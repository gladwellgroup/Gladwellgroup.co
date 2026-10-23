import { requirePermission } from '@/lib/auth/session'
import { getSupabaseServer } from '@/lib/supabase/server'
import { must } from '@/lib/supabase/must'
import { LEAD_SELECT, POSTGREST_MAX_ROWS, type CrmLead } from '@/lib/crm/leads'
import { CrmLeadsTable } from '@/components/portal/crm-leads-table'

export default async function AdminLeadsPage() {
  const user = await requirePermission('leads:read_delegated')
  const supabase = getSupabaseServer()

  const leads = must(
    await supabase
      .from('walking_list_leads')
      .select(LEAD_SELECT)
      .eq('assigned_to', user.id)
      .order('created_at', { ascending: false }),
    'Mis leads'
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-xl sm:text-2xl font-bold gladwell-gradient-text">
          Mis leads
        </h1>
        <p className="text-muted-foreground text-sm">
          Leads delegados a ti para seguimiento.
        </p>
      </div>
      <CrmLeadsTable
        // El select se arma con una lista de columnas: supabase-js no resuelve su tipo en compilación.
        leads={(leads ?? []) as unknown as CrmLead[]}
        truncated={(leads?.length ?? 0) >= POSTGREST_MAX_ROWS}
        admins={[]}
        currentUserId={user.id}
        canDelegate={false}
        canUpdateStatus={user.permissions.includes('leads:update_status')}
      />
    </div>
  )
}
