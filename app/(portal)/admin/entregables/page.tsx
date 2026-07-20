import { requirePermission } from '@/lib/auth/session'
import { getSupabaseServer } from '@/lib/supabase/server'
import { TherapyDashboard } from '@/components/portal/therapy-dashboard'

export default async function AdminEntregablesPage() {
  const user = await requirePermission('therapy:create')
  const supabase = getSupabaseServer()

  const [{ data: sessions }, { data: moderators }, { data: invitados }] =
    await Promise.all([
      supabase
        .from('therapy_sessions')
        .select(
          '*, invitado:invitados(nombre), therapy_session_cofounders(nombre, orden)'
        )
        .or(`created_by.eq.${user.id},moderator_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .order('orden', { referencedTable: 'therapy_session_cofounders' }),
      supabase
        .from('profiles')
        .select('id, nombre, correo')
        .in('role', ['super_admin', 'community_admin'])
        .order('nombre'),
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
      basePath="/admin/entregables"
    />
  )
}
