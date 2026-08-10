import { requirePermission } from '@/lib/auth/session'
import { hasPermission } from '@/lib/permissions'
import { getSupabaseServer } from '@/lib/supabase/server'
import { CrmLeadsTable } from '@/components/portal/crm-leads-table'

export default async function AdminLeadsPage() {
  const user = await requirePermission('leads:read_delegated')
  const supabase = getSupabaseServer()

  const { data: leads } = await supabase
    .from('walking_list_leads')
    .select('*')
    .eq('assigned_to', user.id)
    .order('created_at', { ascending: false })

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
        leads={leads ?? []}
        admins={[]}
        currentUserId={user.id}
        canDelegate={false}
        canUpdateStatus={hasPermission(user.role, 'leads:update_status')}
      />
    </div>
  )
}
