import { requirePermission } from '@/lib/auth/session'
import { getSupabaseServer } from '@/lib/supabase/server'
import { UsuariosTable, type UsuarioRow } from '@/components/portal/usuarios-table'
import type { ModuleKey } from '@/lib/permissions/modules'

export default async function UsuariosPage() {
  const user = await requirePermission('users:list')
  const supabase = getSupabaseServer()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nombre, correo, role, created_at, profile_module_grants!profile_module_grants_profile_id_fkey(module_key)')
    .order('created_at', { ascending: false })

  const users: UsuarioRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    correo: p.correo,
    role: p.role,
    created_at: p.created_at,
    granted_modules: (p.profile_module_grants ?? []).map(
      (g: { module_key: string }) => g.module_key as ModuleKey
    ),
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-xl sm:text-2xl font-bold gladwell-gradient-text">
          Usuarios
        </h1>
        <p className="text-muted-foreground text-sm">
          Administra cuentas, roles y módulos habilitados de la comunidad.
        </p>
      </div>
      <UsuariosTable users={users} canManage={user.permissions.includes('users:create_admin')} />
    </div>
  )
}
