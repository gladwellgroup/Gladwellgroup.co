import { requirePermission } from '@/lib/auth/session'
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
      <div>
        <h1 className="text-2xl font-bold gladwell-gradient-text">Mis leads</h1>
        <p className="text-muted-foreground">
          Leads delegados a ti para seguimiento.
        </p>
      </div>
      <CrmLeadsTable
        leads={leads ?? []}
        admins={[]}
        currentUserId={user.id}
        canDelegate={false}
      />
    </div>
  )
}
