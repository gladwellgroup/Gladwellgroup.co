import { requirePermission } from '@/lib/auth/session'
import { hasPermission } from '@/lib/permissions'
import { getSupabaseServer } from '@/lib/supabase/server'
import { CrmLeadsTable } from '@/components/portal/crm-leads-table'

export default async function CrmPage() {
  const user = await requirePermission('leads:read_all')
  const supabase = getSupabaseServer()

  const { data: leads } = await supabase
    .from('walking_list_leads')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: admins } = await supabase
    .from('profiles')
    .select('id, nombre, correo')
    .eq('role', 'community_admin')

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-xl sm:text-2xl font-bold gladwell-gradient-text">
          CRM | Walking List
        </h1>
        <p className="text-muted-foreground text-sm">
          Todos los leads registrados. Delega a un administrador de comunidad.
        </p>
      </div>
      <CrmLeadsTable
        leads={leads ?? []}
        admins={admins ?? []}
        currentUserId={user.id}
        canDelegate
        canUpdateStatus={hasPermission(user.role, 'leads:update_status')}
      />
    </div>
  )
}
