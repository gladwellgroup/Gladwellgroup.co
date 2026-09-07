import { requirePermission } from '@/lib/auth/session'
import { getSupabaseServer } from '@/lib/supabase/server'
import { TherapyDashboard } from '@/components/portal/therapy-dashboard'

export default async function AdminEntregablesPage() {
  const user = await requirePermission('sessions:read_community')
  const supabase = getSupabaseServer()
  const canCreate = user.permissions.includes('therapy:create')

  // El listado de moderadores (nombre + correo de cada super_admin/
  // community_admin) solo lo usa el selector del formulario "Nueva sesión"
  // — pedirlo para quien no puede crear filtraría el correo de todo el
  // equipo a un payload que nunca lo va a mostrar.
  const [{ data: sessions }, { data: moderators }, { data: invitados }] =
    await Promise.all([
      supabase
        .from('therapy_sessions')
        .select(
          '*, invitado:invitados(nombre), therapy_session_cofounders(nombre, orden)'
        )
        .order('created_at', { ascending: false })
        .order('orden', { referencedTable: 'therapy_session_cofounders' }),
      canCreate
        ? supabase
            .from('profiles')
            .select('id, nombre, correo')
            .in('role', ['super_admin', 'community_admin'])
            .order('nombre')
        : Promise.resolve({ data: [] }),
      supabase
        .from('invitados')
        .select('id, nombre')
        .eq('created_by', user.id)
        .order('nombre'),
    ])

  return (
    <TherapyDashboard
      sessions={sessions ?? []}
      moderators={moderators ?? []}
      invitados={invitados ?? []}
      currentUserId={user.id}
      canCreate={canCreate}
      basePath="/admin/entregables/terapia"
      hubPath="/admin/entregables"
    />
  )
}
