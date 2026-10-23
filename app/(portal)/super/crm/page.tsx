import { requirePermission } from '@/lib/auth/session'
import { getSupabaseServer } from '@/lib/supabase/server'
import { must } from '@/lib/supabase/must'
import { LEAD_SELECT, POSTGREST_MAX_ROWS, type CrmLead } from '@/lib/crm/leads'
import { resolvePermissionsFromGrants, type Role } from '@/lib/permissions'
import { CrmLeadsTable } from '@/components/portal/crm-leads-table'

export default async function CrmPage() {
  const user = await requirePermission('leads:read_all')
  const supabase = getSupabaseServer()

  // En paralelo (antes una consulta esperaba a la otra) y con las columnas que de verdad se pintan. Sin el módulo CRM
  // otorgado, un community_admin no puede abrir /admin/leads — delegarle un lead lo dejaría asignado a alguien que no
  // lo puede ver, por eso se traen sus módulos.
  const [leadsResult, adminsResult] = await Promise.all([
    supabase.from('walking_list_leads').select(LEAD_SELECT).order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, nombre, correo, role, profile_module_grants!profile_module_grants_profile_id_fkey(module_key)')
      .eq('role', 'community_admin'),
  ])
  // `must`: un error de la base se veía como «No hay leads registrados».
  const leads = must(leadsResult, 'Leads')
  const adminRows = must(adminsResult, 'Administradores de comunidad')

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
        // El select se arma con una lista de columnas: supabase-js no resuelve su tipo en compilación.
        leads={(leads ?? []) as unknown as CrmLead[]}
        truncated={(leads?.length ?? 0) >= POSTGREST_MAX_ROWS}
        admins={admins}
        currentUserId={user.id}
        canDelegate
        canUpdateStatus={user.permissions.includes('leads:update_status')}
      />
    </div>
  )
}
