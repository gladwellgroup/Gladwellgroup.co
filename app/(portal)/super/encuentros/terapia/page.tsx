import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/auth/session'
import { getSupabaseServer } from '@/lib/supabase/server'
import { must } from '@/lib/supabase/must'
import { TherapyDashboard } from '@/components/portal/therapy-dashboard'

export default async function SuperTerapiaPage() {
  const user = await requirePermission('sessions:read_community')
  if (user.role !== 'super_admin') redirect('/admin/encuentros/terapia')
  const supabase = getSupabaseServer()

  const [sessionsResult, moderatorsResult, invitadosResult] =
    await Promise.all([
      supabase
        .from('therapy_sessions')
        .select(
          '*, invitado:invitados(nombre), therapy_session_cofounders(nombre, orden)'
        )
        .order('created_at', { ascending: false })
        .order('orden', { referencedTable: 'therapy_session_cofounders' }),
      supabase
        .from('profiles')
        .select('id, nombre, correo')
        .in('role', ['super_admin', 'community_admin'])
        .order('nombre'),
      supabase.from('invitados').select('id, nombre').order('nombre'),
    ])
  const sessions = must(sessionsResult, 'Sesiones de Terapia')
  const moderators = must(moderatorsResult, 'Moderadores')
  const invitados = must(invitadosResult, 'Invitados')

  return (
    <TherapyDashboard
      sessions={sessions ?? []}
      moderators={moderators ?? []}
      invitados={invitados ?? []}
      currentUserId={user.id}
      canCreate={user.permissions.includes('therapy:create')}
      basePath="/super/encuentros/terapia"
      hubPath="/super/encuentros"
    />
  )
}
