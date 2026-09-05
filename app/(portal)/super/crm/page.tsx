import { requirePermission } from '@/lib/auth/session'
import { getSupabaseServer } from '@/lib/supabase/server'
import { resolvePermissionsFromGrants, type Role } from '@/lib/permissions'
import { CrmLeadsTable } from '@/components/portal/crm-leads-table'

export default async function CrmPage() {
  const user = await requirePermission('leads:read_all')
  const supabase = getSupabaseServer()

  const { data: leads } = await supabase
    .from('walking_list_leads')
    .select('*')
    .order('created_at', { ascending: false })

  // Sin el módulo CRM otorgado, un community_admin no puede abrir /admin/leads
  // — delegarle un lead lo dejaría asignado a alguien que no lo puede ver.
  const { data: adminRows } = await supabase
    .from('profiles')
    .select('id, nombre, correo, role, profile_module_grants!profile_module_grants_profile_id_fkey(module_key)')
    .eq('role', 'community_admin')

  const admins = (adminRows ?? [])
    .filter((a) =>
      resolvePermissionsFromGrants(a.role as Role, a.profile_module_grants).includes(
        'leads:read_delegated'
      )
    )
    .map((a) => ({ id: a.id, nombre: a.nombre, correo: a.correo }))

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
        admins={admins}
        currentUserId={user.id}
        canDelegate
        canUpdateStatus={user.permissions.includes('leads:update_status')}
      />
    </div>
  )
}
